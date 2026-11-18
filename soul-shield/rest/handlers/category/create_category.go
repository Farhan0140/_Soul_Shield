package category

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"soulsheld/repo"
	"soulsheld/rest/middlewares"
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
	userID, ok := middlewares.UserID(r)
	if !ok {
		util.SendError(w, map[string]string{"error": "Unauthorize"}, http.StatusUnauthorized)
		return
	}

	var req CreateCategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, map[string]string{"error": "Invalid Request Body"}, http.StatusBadRequest)
		return
	}
	name, err := validateName(req.Name)
	if err != nil {
		util.SendError(w, map[string]string{"error": err.Error()}, http.StatusBadRequest)
		return
	}
	req.Name = name
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
		if errors.Is(err, util.ErrCategoryExists) {
			util.SendError(w, map[string]string{"error": err.Error()}, http.StatusConflict)
			return
		}
		util.SendError(w, map[string]string{"error": "Failed to create category"}, http.StatusInternalServerError)
		return
	}

	h.pushRepo.NotifyDataChange(userID)

	util.SendData(w, CategoryResponse{ID: created.ID, UUID: created.UUID, Name: created.Name, ColorHex: created.ColorHex, Position: created.Position}, http.StatusCreated)
}
