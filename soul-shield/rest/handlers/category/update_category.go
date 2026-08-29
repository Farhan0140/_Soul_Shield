package category

import (
	"encoding/json"
	"net/http"
	"soulsheld/repo"
	"soulsheld/util"
	"strconv"
)

// UpdateCategory godoc
//
// @Summary Update category
// @Description শুধু category এর owner ই আপডেট করতে পারবে
// @Tags Categories
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path int true "Category ID"
// @Param body body UpdateCategoryRequest true "Fields to update"
// @Success 200 {object} CategoryResponse
// @Failure 400 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Router /categories/{id} [patch]
func (h *Handler) UpdateCategory(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	// URL থেকে {id} বের করে int64 তে রূপান্তর করছি
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		util.SendError(w, map[string]string{"error": "Invalid category id"}, http.StatusBadRequest)
		return
	}

	var req UpdateCategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, map[string]string{"error": "Invalid Request Body"}, http.StatusBadRequest)
		return
	}

	// color_hex দিলে ফরম্যাট ঠিক আছে কিনা চেক করছি
	if req.ColorHex != nil && !hexColorRegex.MatchString(*req.ColorHex) {
		util.SendError(w, map[string]string{"error": "Invalid hex color format"}, http.StatusBadRequest)
		return
	}

	updates := repo.CategoryUpdate{
		Name:     req.Name,
		ColorHex: req.ColorHex,
	}

	updated, err := h.categoryRepo.Update(id, updates, userID)
	if err != nil {
		switch err {
		case util.ErrCategoryNotFound:
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusNotFound)
		case util.ErrForbidden:
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusForbidden)
		default:
			util.SendError(w, map[string]string{"error": "Failed to update category"}, http.StatusInternalServerError)
		}
		return
	}

	util.SendData(w, CategoryResponse{
		ID:       updated.ID,
		Name:     updated.Name,
		ColorHex: updated.ColorHex,
		Position: updated.Position,
	}, http.StatusOK)
}