package category

import (
	"net/http"
	"soulsheld/util"
	"strconv"
)

// DeleteCategory godoc
//
// @Summary Delete category
// @Description Delete করলে যেসব task এই category ব্যবহার করছিল সেগুলো uncategorized হয়ে যাবে (task মুছে যাবে না)
// @Tags Categories
// @Security BearerAuth
// @Produce json
// @Param id path int true "Category ID"
// @Success 200 {object} SuccessResponse
// @Failure 403 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /categories/{id} [delete]
func (h *Handler) DeleteCategory(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		util.SendError(w, map[string]string{"error": "Invalid category id"}, http.StatusBadRequest)
		return
	}

	err = h.categoryRepo.Delete(id, userID)
	if err != nil {
		switch err {
		case util.ErrCategoryNotFound:
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusNotFound)
		case util.ErrForbidden:
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusForbidden)
		default:
			util.SendError(w, map[string]string{"error": "Failed to delete category"}, http.StatusInternalServerError)
		}
		return
	}

	util.SendData(w, map[string]string{"message": "Category deleted successfully"}, http.StatusOK)
}