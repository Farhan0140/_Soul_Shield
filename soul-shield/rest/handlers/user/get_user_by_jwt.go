package user

import (
	"errors"
	"log/slog"
	"net/http"
	"soulsheld/rest/middlewares"
	"soulsheld/util"
)

// GetUser godoc
//
// @Summary Current User
// @Description Returns the signed-in user's CURRENT name, email and role from the database.
// @Tags Users
// @Security BearerAuth
// @Produce json
// @Success 200 {object} SuccessResponse
// @Failure 401 {object} ErrorResponse
// @Router /users/me [get]
func (h *Handler) GetUserByJWT(w http.ResponseWriter, r *http.Request) {
	userID, ok := middlewares.UserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	user, err := h.userRepo.GetByID(userID)
	if err != nil {
		if errors.Is(err, util.ErrUserNotFound) {
			unauthorized(w)
			return
		}
		slog.Error("get current user failed", "user_id", userID, "error", err)
		util.SendError(w, map[string]string{
			"error": "Internal Server Error",
		}, http.StatusInternalServerError)
		return
	}

	util.SendData(w, map[string]any{
		"id":         user.ID,
		"full_name":  user.Full_Name,
		"email":      user.Email,
		"role":       user.Role,
		"created_at": user.CreatedAt,
	}, http.StatusOK)
}
