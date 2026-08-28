package task

import (
	"database/sql"
	"net/http"
	"soulsheld/repo"
	"soulsheld/util"
	"strconv"
)

// AddToMyTasks godoc
//
// @Summary Add a fixed (admin) task to the current user's own tasks
// @Description একটা is_global fixed task থেকে বর্তমান ইউজারের জন্য একটা personal কপি তৈরি করে।
// @Description ▹ category: admin task এর category name এর সাথে ম্যাচ করা (case-insensitive) user category থাকলে সেটা reuse করা হয়, না থাকলে নতুন category তৈরি হয়
// @Description ▹ duplicate: user এর আগে থেকেই এই fixed task এর কপি থাকলে (lineage বা case-insensitive title ম্যাচে) নতুন কিছু তৈরি হয় না, already_added=true রিটার্ন হয়
// @Description ▹ sub_tasks সহ সব প্রাসঙ্গিক তথ্য কপি করা হয়; original admin task অপরিবর্তিত থাকে
// @Tags Tasks
// @Security BearerAuth
// @Produce json
// @Param id path int true "Fixed Task ID"
// @Success 200 {object} AddToMyTasksResponse "Already added"
// @Success 201 {object} AddToMyTasksResponse "Newly added"
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /tasks/{id}/add-to-my-tasks [post]
func (h *Handler) AddToMyTasks(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	sourceID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		util.SendError(w, map[string]string{"error": "Invalid task id"}, http.StatusBadRequest)
		return
	}

	source, err := h.taskRepo.GetByID(sourceID)
	if err != nil {
		switch err {
		case util.ErrTaskNotFound:
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusNotFound)
		default:
			util.SendError(w, map[string]string{"error": "Failed to fetch task"}, http.StatusInternalServerError)
		}
		return
	}

	if !source.IsGlobal || !source.IsActive {
		util.SendError(w, map[string]string{"error": util.ErrTaskNotGlobal.Error()}, http.StatusBadRequest)
		return
	}

	// ---- Duplicate check: lineage (source_task_id) অথবা case-insensitive title ম্যাচ ----
	if existing, err := h.taskRepo.FindOwnedMatch(userID, source.ID, source.Title); err == nil {
		var catID *int64
		if existing.CategoryID.Valid {
			id := existing.CategoryID.Int64
			catID = &id
		}
		util.SendData(w, AddToMyTasksResponse{
			AlreadyAdded: true,
			TaskID:       existing.ID,
			CategoryID:   catID,
		}, http.StatusOK)
		return
	} else if err != util.ErrTaskNotFound {
		util.SendError(w, map[string]string{"error": "Failed to check existing tasks"}, http.StatusInternalServerError)
		return
	}

	// ---- Category resolve: একই নামে (case-insensitive) user এর category থাকলে reuse, না থাকলে তৈরি ----
	var categoryID sql.NullInt64
	var categoryName string
	if source.CategoryID.Valid {
		srcCat, err := h.categoryRepo.GetByID(source.CategoryID.Int64)
		if err != nil {
			util.SendError(w, map[string]string{"error": "Failed to resolve category"}, http.StatusInternalServerError)
			return
		}

		userCat, err := h.categoryRepo.FindByOwnerAndNameCI(userID, srcCat.Name)
		if err != nil {
			if err != util.ErrCategoryNotFound {
				util.SendError(w, map[string]string{"error": "Failed to resolve category"}, http.StatusInternalServerError)
				return
			}
			userCat, err = h.categoryRepo.Create(repo.Category{
				Name:     srcCat.Name,
				ColorHex: srcCat.ColorHex,
				OwnerID:  userID,
			})
			if err != nil {
				util.SendError(w, map[string]string{"error": "Failed to create category"}, http.StatusInternalServerError)
				return
			}
		}

		categoryID = sql.NullInt64{Int64: userCat.ID, Valid: true}
		categoryName = userCat.Name
	}

	newTask := repo.Task{
		Title:           source.Title,
		Description:     source.Description,
		IsGlobal:        false,
		OwnerID:         sql.NullInt64{Int64: userID, Valid: true},
		RecurrenceType:  source.RecurrenceType,
		RecurrenceDays:  source.RecurrenceDays,
		CreatedBy:       userID,
		CategoryID:      categoryID,
		RewardText:      source.RewardText,
		TaskType:        source.TaskType,
		TargetCount:     source.TargetCount,
		DurationSeconds: source.DurationSeconds,
		ReminderTime:    source.ReminderTime,
		SourceTaskID:    sql.NullInt64{Int64: source.ID, Valid: true},
	}

	created, err := h.taskRepo.Create(newTask)
	if err != nil {
		util.SendError(w, map[string]string{"error": "Failed to add task"}, http.StatusInternalServerError)
		return
	}

	// ---- Sub-tasks কপি; ব্যর্থ হলে orphan parent রেখে দিব না, delete করে দিব (create_task.go এর প্যাটার্ন) ----
	sourceSubTasks, err := h.subTaskRepo.ListByParentIDs([]int64{source.ID})
	if err != nil {
		_ = h.taskRepo.Delete(created.ID, userID, "user")
		util.SendError(w, map[string]string{"error": "Failed to copy sub-tasks"}, http.StatusInternalServerError)
		return
	}

	if subs := sourceSubTasks[source.ID]; len(subs) > 0 {
		inputs := make([]repo.SubTask, len(subs))
		for i, st := range subs {
			inputs[i] = repo.SubTask{
				Title:           st.Title,
				TaskType:        st.TaskType,
				TargetCount:     st.TargetCount,
				DurationSeconds: st.DurationSeconds,
			}
		}
		if _, err := h.subTaskRepo.ReplaceForParent(created.ID, inputs); err != nil {
			_ = h.taskRepo.Delete(created.ID, userID, "user")
			util.SendError(w, map[string]string{"error": "Failed to copy sub-tasks"}, http.StatusInternalServerError)
			return
		}
	}

	var respCategoryID *int64
	if categoryID.Valid {
		id := categoryID.Int64
		respCategoryID = &id
	}

	util.SendData(w, AddToMyTasksResponse{
		AlreadyAdded: false,
		TaskID:       created.ID,
		CategoryID:   respCategoryID,
		CategoryName: categoryName,
	}, http.StatusCreated)
}
