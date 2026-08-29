package category

import (
	"encoding/json"
	"net/http"
	"soulsheld/util"
)

// ReorderCategories godoc
//
// @Summary Reorder my categories
// @Description caller এর সব category এর জন্য নতুন display order সেট করে। ordered_ids এ অবশ্যই
// @Description caller এর বর্তমান সব category id (কোনোটা বাদ না দিয়ে, নতুন কোনোটা না যোগ করে) নতুন
// @Description ক্রমে থাকতে হবে - অন্য ডিভাইস থেকে ইতিমধ্যে কিছু বদলে থাকলে 409 রিটার্ন করবে।
// @Tags Categories
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body ReorderCategoriesRequest true "New category order"
// @Success 200 {array} CategoryResponse
// @Failure 400 {object} ErrorResponse
// @Failure 409 {object} ErrorResponse
// @Router /categories/reorder [patch]
func (h *Handler) ReorderCategories(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	var req ReorderCategoriesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, map[string]string{"error": "Invalid Request Body"}, http.StatusBadRequest)
		return
	}

	reordered, err := h.categoryRepo.Reorder(userID, req.OrderedIDs)
	if err != nil {
		switch err {
		case util.ErrEmptyOrder:
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusBadRequest)
		case util.ErrOrderMismatch:
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusConflict)
		default:
			util.SendError(w, map[string]string{"error": "Failed to reorder categories"}, http.StatusInternalServerError)
		}
		return
	}

	response := make([]CategoryResponse, len(reordered))
	for i, c := range reordered {
		response[i] = CategoryResponse{ID: c.ID, Name: c.Name, ColorHex: c.ColorHex, Position: c.Position}
	}

	util.SendData(w, response, http.StatusOK)
}
