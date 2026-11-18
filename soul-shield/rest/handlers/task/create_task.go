package task

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"regexp"
	"soulsheld/repo"
	"soulsheld/rest/middlewares"
	"soulsheld/util"
)

var reminderTimePattern = regexp.MustCompile(`^([01]\d|2[0-3]):[0-5]\d$`)

// CreateTask godoc
//
// @Summary Create task
// @Description User বা Admin task তৈরি করতে পারবে। is_global=true শুধু admin ব্যবহার করতে পারবে।
// @Description ▹ for recurrence_days: 0=Sunday ... 6=Saturday.
// @Description ▹ recurrence_type: 'daily', 'weekly', 'custom'. 'daily' হলে সব দিন auto বসিয়ে দেওয়া হবে insert time এ
// @Description ▹ category_id: এই field না দিলে global task হিসেবে create হবে, category_id রাখতে চাইলে category id must দিতে হবে
// @Description ▹ task_type "normal" হলে target_count/duration_seconds optional, "counter" হলে target_count must, "timer" হলে duration_seconds must দিতে হবে
// @Description ▹ "counter" type task for dhikr
// @Description ▹ "timer" type task duration_seconds (সেকেন্ডে) পূর্ণ হলে client existing /complete endpoint কল করবে
// @Tags Tasks
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body CreateTaskRequest true "Task Info"
// @Success 201 {object} TaskResponse
// @Failure 400 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Router /tasks [post]
func (h *Handler) CreateTask(w http.ResponseWriter, r *http.Request) {
	userID, ok := middlewares.UserID(r)
	if !ok {
		unauthorized(w)
		return
	}
	role := middlewares.Role(r)

	var req CreateTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, map[string]string{"error": "Invalid Request Body"}, http.StatusBadRequest)
		return
	}

	// ---- বেসিক ভ্যালিডেশন ----
	title, err := validateTitle(req.Title)
	if err != nil {
		util.SendError(w, map[string]string{"error": err.Error()}, http.StatusBadRequest)
		return
	}
	req.Title = title
	if req.RecurrenceType == "" {
		req.RecurrenceType = util.RecurrenceCustom // the column's default
	}
	if err := validateRecurrenceType(req.RecurrenceType); err != nil {
		util.SendError(w, map[string]string{"error": err.Error()}, http.StatusBadRequest)
		return
	}

	if req.IsGlobal && role != "admin" {
		util.SendError(w, map[string]string{"error": "Only admin can create global tasks"}, http.StatusForbidden)
		return
	}

	// task_type খালি থাকলে ডিফল্ট "normal" ধরা হবে
	taskType := req.TaskType
	if taskType == "" {
		taskType = "normal"
	}
	if taskType != "normal" && taskType != "counter" && taskType != "timer" {
		util.SendError(w, map[string]string{"error": "task_type must be 'normal', 'counter' or 'timer'"}, http.StatusBadRequest)
		return
	}

	// counter টাইপ হলে target_count অবশ্যই থাকতে হবে এবং ০ এর চেয়ে বড় হতে হবে
	if taskType == "counter" && (req.TargetCount == nil || *req.TargetCount <= 0) {
		util.SendError(w, map[string]string{"error": "target_count is required and must be > 0 for counter tasks"}, http.StatusBadRequest)
		return
	}

	// timer টাইপ হলে duration_seconds অবশ্যই থাকতে হবে এবং ০ এর চেয়ে বড় হতে হবে
	if taskType == "timer" && (req.DurationSeconds == nil || *req.DurationSeconds <= 0) {
		util.SendError(w, map[string]string{"error": "duration_seconds is required and must be > 0 for timer tasks"}, http.StatusBadRequest)
		return
	}

	if req.ReminderTime != nil && *req.ReminderTime != "" && !reminderTimePattern.MatchString(*req.ReminderTime) {
		util.SendError(w, map[string]string{"error": util.ErrInvalidReminderTime.Error()}, http.StatusBadRequest)
		return
	}

	// ---- sub_tasks বেসিক ভ্যালিডেশন (repo.ReplaceForParent এও একই চেক হবে, কিন্তু early-exit এর জন্য এখানেও) ----
	for _, st := range req.SubTasks {
		if st.Title == "" {
			util.SendError(w, map[string]string{"error": util.ErrSubTaskTitleRequired.Error()}, http.StatusBadRequest)
			return
		}
		stType := st.TaskType
		if stType == "" {
			stType = "normal"
		}
		if stType != "normal" && stType != "counter" && stType != "timer" {
			util.SendError(w, map[string]string{"error": "sub-task task_type must be 'normal', 'counter' or 'timer'"}, http.StatusBadRequest)
			return
		}
		if stType == "counter" && (st.TargetCount == nil || *st.TargetCount <= 0) {
			util.SendError(w, map[string]string{"error": "target_count is required and must be > 0 for counter sub-tasks"}, http.StatusBadRequest)
			return
		}
		if stType == "timer" && (st.DurationSeconds == nil || *st.DurationSeconds <= 0) {
			util.SendError(w, map[string]string{"error": "duration_seconds is required and must be > 0 for timer sub-tasks"}, http.StatusBadRequest)
			return
		}
	}

	// ---- repo.Task বানানো ----
	newTask := repo.Task{
		Title:          req.Title,
		RecurrenceType: req.RecurrenceType,
		CreatedBy:      userID,
		IsGlobal:       req.IsGlobal,
		TaskType:       taskType,
	}

	// Description optional, তাই NullString দিয়ে হ্যান্ডেল করছি
	newTask.Description.String = req.Description
	newTask.Description.Valid = req.Description != ""

	// RewardText ও optional
	newTask.RewardText.String = req.RewardText
	newTask.RewardText.Valid = req.RewardText != ""

	// ReminderTime ও optional
	if req.ReminderTime != nil {
		newTask.ReminderTime.String = *req.ReminderTime
		newTask.ReminderTime.Valid = *req.ReminderTime != ""
	}

	// personal task হলে (is_global=false) owner_id বসবে যেই লগিন করা আছে তার id
	if !req.IsGlobal {
		newTask.OwnerID.Int64 = userID
		newTask.OwnerID.Valid = true
	}

	// category_id optional
	if req.CategoryID != nil {
		newTask.CategoryID.Int64 = *req.CategoryID
		newTask.CategoryID.Valid = true
	}

	// target_count শুধু counter টাইপে থাকবে
	if req.TargetCount != nil {
		newTask.TargetCount.Int32 = *req.TargetCount
		newTask.TargetCount.Valid = true
	}

	// duration_seconds শুধু timer টাইপে থাকবে
	if req.DurationSeconds != nil {
		newTask.DurationSeconds.Int32 = *req.DurationSeconds
		newTask.DurationSeconds.Valid = true
	}

	// recurrence_days slice কপি করছি (nil হলেও ঠিকমতো কাজ করবে)
	days := make([]int64, len(req.RecurrenceDays))
	copy(days, req.RecurrenceDays)
	newTask.RecurrenceDays = days

	// ---- sub-task inputs ----
	var subInputs []repo.SubTask
	if len(req.SubTasks) > 0 {
		subInputs = make([]repo.SubTask, len(req.SubTasks))
		for i, st := range req.SubTasks {
			stType := st.TaskType
			if stType == "" {
				stType = "normal"
			}
			sub := repo.SubTask{Title: st.Title, TaskType: stType}
			if st.Description != nil {
				sub.Description = sql.NullString{String: *st.Description, Valid: true}
			}
			if st.TargetCount != nil {
				sub.TargetCount = sql.NullInt32{Int32: *st.TargetCount, Valid: true}
			}
			if st.DurationSeconds != nil {
				sub.DurationSeconds = sql.NullInt32{Int32: *st.DurationSeconds, Valid: true}
			}
			subInputs[i] = sub
		}
	}

	// ---- Database এ insert (task + sub-tasks in one transaction) ----
	created, createdSubTasks, err := h.taskRepo.CreateWithSubTasks(newTask, subInputs)
	if err != nil {
		switch {
		case errors.Is(err, util.ErrInvalidRecurrence),
			errors.Is(err, util.ErrInvalidCounterTarget),
			errors.Is(err, util.ErrInvalidTimerDuration),
			errors.Is(err, util.ErrCategoryNotFound),
			errors.Is(err, util.ErrSubTaskTitleRequired):
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusBadRequest)
		case errors.Is(err, util.ErrInvalidInput):
			slog.Warn("create task: database refused input", "user_id", userID, "error", err)
			util.SendError(w, map[string]string{"error": util.ErrInvalidInput.Error()}, http.StatusBadRequest)
		case errors.Is(err, util.ErrForbidden):
			util.SendError(w, map[string]string{"error": "You cannot use this category"}, http.StatusForbidden)
		default:
			slog.Error("create task failed", "user_id", userID, "error", err)
			util.SendError(w, map[string]string{"error": "Failed to create task"}, http.StatusInternalServerError)
		}
		return
	}

	h.pushRepo.NotifyDataChange(userID)

	util.SendData(w, toTaskResponse(created, createdSubTasks), http.StatusCreated)
}
