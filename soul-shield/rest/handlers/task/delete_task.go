package task

import (
	"net/http"
	"soulsheld/util"
	"strconv"
)

// DeleteTask godoc
//
// @Summary Delete task
// @Description Hard delete করে, কিন্তু completion history অক্ষত থাকে (snapshot হিসেবে)
// @Tags Tasks
// @Security BearerAuth
// @Produce json
// @Param id path int true "Task ID"
// @Success 200 {object} SuccessResponse
// @Failure 403 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /tasks/{id} [delete]
func (h *Handler) DeleteTask(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		unauthorized(w)
		return
	}
	role := getRole(r)

	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		util.SendError(w, map[string]string{"error": "Invalid task id"}, http.StatusBadRequest)
		return
	}

	err = h.taskRepo.Delete(id, userID, role)
	if err != nil {
		switch err {
		case util.ErrTaskNotFound:
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusNotFound)
		case util.ErrForbidden:
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusForbidden)
		default:
			util.SendError(w, map[string]string{"error": "Failed to delete task"}, http.StatusInternalServerError)
		}
		return
	}

	util.SendData(w, map[string]string{"message": "Task deleted successfully"}, http.StatusOK)
}