package category

import (
	"encoding/json"
	"net/http"
	"regexp"
	"soulsheld/repo"
	"soulsheld/util"
)

var hexColorRegex = regexp.MustCompile(`^#[0-9A-Fa-f]{6}$`)

// CreateCategory godoc
// @Summary Create category
// @Tags Categories
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body CreateCategoryRequest true "Category info"
// @Success 201 {object} CategoryResponse
// @Failure 400 {object} ErrorResponse
// @Router /categories [post]
func (h *Handler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value("userID").(int64)
	if !ok {
		util.SendError(w, map[string]string{"error": "Unauthorize"}, http.StatusUnauthorized)
		return
	}

	var req CreateCategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, map[string]string{"error": "Invalid Request Body"}, http.StatusBadRequest)
		return
	}
	if req.Name == "" {
		util.SendError(w, map[string]string{"error": "Name is required"}, http.StatusBadRequest)
		return
	}
	if req.ColorHex == "" {
		req.ColorHex = "#CCCCCC"
	} else if !hexColorRegex.MatchString(req.ColorHex) {
		util.SendError(w, map[string]string{"error": "Invalid hex color format"}, http.StatusBadRequest)
		return
	}

	created, err := h.categoryRepo.Create(repo.Category{
		Name:     req.Name,
		ColorHex: req.ColorHex,
		OwnerID:  int64(userID),
	})
	if err != nil {
		if err == util.ErrCategoryExists {
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusConflict)
			return
		}
		util.SendError(w, map[string]string{"error": "Failed to create category"}, http.StatusInternalServerError)
		return
	}

	util.SendData(w, CategoryResponse{ID: created.ID, Name: created.Name, ColorHex: created.ColorHex}, http.StatusCreated)
}