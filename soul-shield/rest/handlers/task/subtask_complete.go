package task

import (
	"encoding/json"
	"net/http"
	"soulsheld/util"
	"strconv"
	"time"
)

// CompleteSubTask godoc
//
// @Summary Mark a normal-type sub-task as completed for a given date
// @Description date না দিলে আজকের তারিখ ধরা হবে। Sub-task এর নিজের recurrence নাই - parent task যেই দিন scheduled সেই দিনেই complete করা যাবে।
// @Tags Tasks
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param taskId path int true "Parent Task ID"
// @Param subTaskId path int true "Sub-Task ID"
// @Param body body CompleteTaskRequest false "Optional date"
// @Success 200 {object} SubTaskCompletionResponse
// @Failure 400 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /tasks/{taskId}/subtasks/{subTaskId}/complete [post]
func (h *Handler) CompleteSubTask(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	taskID, subTaskID, ok := parseSubTaskPath(w, r)
	if !ok {
		return
	}

	var req CompleteTaskRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	date := time.Now()
	if req.Date != "" {
		parsed, err := time.Parse("2006-01-02", req.Date)
		if err != nil {
			util.SendError(w, map[string]string{"error": "Invalid date format, use YYYY-MM-DD"}, http.StatusBadRequest)
			return
		}
		date = parsed
	}

	completion, err := h.subTaskRepo.Complete(taskID, subTaskID, userID, date)
	if err != nil {
		sendSubTaskError(w, err)
		return
	}

	parentStatus, parentRewardText, err := h.computeParentStatusAfterAction(taskID, userID, date)
	if err != nil {
		util.SendError(w, map[string]string{"error": "Failed to compute parent status"}, http.StatusInternalServerError)
		return
	}

	util.SendData(w, toSubTaskCompletionResponse(completion, parentStatus, parentRewardText), http.StatusOK)
}

// parseSubTaskPath - {taskId}/{subTaskId} path values পার্স করে, ইনভ্যালিড হলে নিজেই error response লিখে false রিটার্ন করে
func parseSubTaskPath(w http.ResponseWriter, r *http.Request) (taskID, subTaskID int64, ok bool) {
	taskID, err := strconv.ParseInt(r.PathValue("taskId"), 10, 64)
	if err != nil {
		util.SendError(w, map[string]string{"error": "Invalid task id"}, http.StatusBadRequest)
		return 0, 0, false
	}
	subTaskID, err = strconv.ParseInt(r.PathValue("subTaskId"), 10, 64)
	if err != nil {
		util.SendError(w, map[string]string{"error": "Invalid sub-task id"}, http.StatusBadRequest)
		return 0, 0, false
	}
	return taskID, subTaskID, true
}

func sendSubTaskError(w http.ResponseWriter, err error) {
	switch err {
	case util.ErrTaskNotFound, util.ErrSubTaskNotFound:
		util.SendError(w, map[string]string{"error": err.Error()}, http.StatusNotFound)
	case util.ErrForbidden:
		util.SendError(w, map[string]string{"error": err.Error()}, http.StatusForbidden)
	case util.ErrTaskNotScheduled, util.ErrNotCounterTask, util.ErrInvalidIncrementAmount:
		util.SendError(w, map[string]string{"error": err.Error()}, http.StatusBadRequest)
	default:
		util.SendError(w, map[string]string{"error": "Failed to update sub-task"}, http.StatusInternalServerError)
	}
}

// computeParentStatusAfterAction - একটা sub-task action এর পর সেই দিনের জন্য parent এর aggregate
// status পুনরায় গণনা করে, আর status completed হলে parent এর reward_text ও রিটার্ন করে।
func (h *Handler) computeParentStatusAfterAction(taskID, userID int64, date time.Time) (string, *string, error) {
	subsByParent, err := h.subTaskRepo.ListWithStatusForDate(userID, []int64{taskID}, date)
	if err != nil {
		return "", nil, err
	}

	dateStr := date.Format("2006-01-02")
	today := time.Now().Format("2006-01-02")
	status := computeParentStatus(subsByParent[taskID], dateStr, today)

	var rewardText *string
	if status == util.StatusCompleted {
		if parent, err := h.taskRepo.GetByID(taskID); err == nil && parent.RewardText.Valid {
			rt := parent.RewardText.String
			rewardText = &rt
		}
	}

	return status, rewardText, nil
}
