package category

import (
	"net/http"
	"soulsheld/util"
)

// ListCategories godoc
//
// @Summary List my categories
// @Description লগইন করা user এর তৈরি করা সব category লিস্ট করে
// @Tags Categories
// @Security BearerAuth
// @Produce json
// @Success 200 {array} CategoryResponse
// @Failure 401 {object} ErrorResponse
// @Router /categories [get]
func (h *Handler) ListCategories(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	categories, err := h.categoryRepo.ListByOwner(userID)
	if err != nil {
		util.SendError(w, map[string]string{"error": "Failed to fetch categories"}, http.StatusInternalServerError)
		return
	}

	// repo.Category slice কে CategoryResponse slice এ কনভার্ট করছি
	response := make([]CategoryResponse, len(categories))
	for i, c := range categories {
		response[i] = CategoryResponse{
			ID:       c.ID,
			Name:     c.Name,
			ColorHex: c.ColorHex,
			Position: c.Position,
		}
	}

	util.SendData(w, response, http.StatusOK)
}