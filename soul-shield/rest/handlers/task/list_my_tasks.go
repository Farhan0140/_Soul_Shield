package task

import (
	"net/http"
	"soulsheld/util"
)

// ListMyTasks godoc
//
// @Summary List all my personal tasks, flat (no date/recurrence filtering)
// @Description caller এর সব personal task (fixed/admin task বাদে) date বা recurrence_days
// @Description দিয়ে ফিল্টার না করেই রিটার্ন করে - dedicated "Reorder" পেজের জন্য বানানো, যেখানে
// @Description ইউজার category/task/sub-task এর ক্রম date-independent ভাবে সাজায় (PATCH
// @Description /tasks/reorder এর ID-set validation ও ঠিক এই সেটটার সাথেই মেলে)।
// @Tags Tasks
// @Security BearerAuth
// @Produce json
// @Success 200 {array} ManageableTaskResponse
// @Failure 401 {object} ErrorResponse
// @Router /tasks/mine [get]
func (h *Handler) ListMyTasks(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	tasks, err := h.taskRepo.ListAllOwnedFlat(userID)
	if err != nil {
		util.SendError(w, map[string]string{"error": "Failed to fetch tasks"}, http.StatusInternalServerError)
		return
	}

	ids := make([]int64, len(tasks))
	for i, t := range tasks {
		ids[i] = t.ID
	}
	subsByParent, err := h.subTaskRepo.ListByParentIDs(ids)
	if err != nil {
		util.SendError(w, map[string]string{"error": "Failed to fetch tasks"}, http.StatusInternalServerError)
		return
	}

	// category_id in the response is the category's uuid (see repo.Task's UUID
	// doc comment in repo/models.go) - ListAllOwnedFlat doesn't join
	// categories, so resolve id -> uuid via this user's own category list.
	categories, err := h.categoryRepo.ListByOwner(userID)
	if err != nil {
		util.SendError(w, map[string]string{"error": "Failed to fetch tasks"}, http.StatusInternalServerError)
		return
	}
	categoryUUIDByID := make(map[int64]string, len(categories))
	for _, c := range categories {
		categoryUUIDByID[c.ID] = c.UUID
	}

	response := make([]ManageableTaskResponse, len(tasks))
	for i, t := range tasks {
		var categoryID *string
		if t.CategoryID.Valid {
			if uuid, ok := categoryUUIDByID[t.CategoryID.Int64]; ok {
				categoryID = &uuid
			}
		}

		item := ManageableTaskResponse{ID: t.UUID, Title: t.Title, CategoryID: categoryID, Position: t.Position}
		if subs := subsByParent[t.ID]; len(subs) > 0 {
			item.SubTasks = make([]SubTaskStatusResponse, len(subs))
			for j, s := range subs {
				item.SubTasks[j] = toSubTaskResponse(s)
			}
		}
		response[i] = item
	}

	util.SendData(w, response, http.StatusOK)
}
