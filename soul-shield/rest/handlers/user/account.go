package user

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"soulsheld/rest/middlewares"
	"soulsheld/util"
)

// NOTE on status codes: a wrong current password answers 400, not 401. The
// mobile app treats ANY 401 as "session expired" and signs the user out, which
// would be the wrong reaction to a typo in this form.

// ChangePassword godoc
//
// @Summary Change password
// @Description Change the signed-in user's password. Requires the current password.
// @Tags Users
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body ChangePasswordRequest true "Current and new password"
// @Description Bumps the account's token version, which signs out every OTHER device;
// @Description the response carries a fresh session token for this one.
// @Success 200 {object} ChangePasswordResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 429 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /users/change-password [post]
func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	userID, ok := middlewares.UserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, map[string]string{"error": "Invalid request"}, http.StatusBadRequest)
		return
	}
	if req.CurrentPassword == "" {
		util.SendError(w, map[string]string{"error": "Current password is required"}, http.StatusBadRequest)
		return
	}
	if err := util.ValidateNewPassword(req.NewPassword); err != nil {
		util.SendError(w, map[string]string{"error": err.Error()}, http.StatusBadRequest)
		return
	}

	if rejectIfRateLimited(w, rateLimitCheck{h.limiters.changePasswordByUID, userKey(userID)}) {
		return
	}

	updated, err := h.userRepo.ChangePassword(userID, req.CurrentPassword, req.NewPassword)
	switch {
	case err == nil:
		token, tokenErr := util.CreateJWT(h.cnf.SecretKey, util.CustomClaims{
			ID:           updated.ID,
			Full_Name:    updated.Full_Name,
			Email:        updated.Email,
			Role:         updated.Role,
			TokenVersion: updated.TokenVersion,
		})
		if tokenErr != nil {
			// The password DID change; this device just has to sign in again.
			slog.Error("change password: issuing new token failed", "user_id", userID, "error", tokenErr)
			util.SendData(w, ChangePasswordResponse{Message: "Password updated. Please sign in again."}, http.StatusOK)
			return
		}
		util.SendData(w, ChangePasswordResponse{Message: "Password updated successfully", Token: token}, http.StatusOK)
	case errors.Is(err, util.ErrCurrentPasswordIncorrect):
		util.SendError(w, map[string]string{"error": err.Error()}, http.StatusBadRequest)
	case errors.Is(err, util.ErrUserNotFound):
		unauthorized(w)
	default:
		slog.Error("change password failed", "user_id", userID, "error", err)
		util.SendError(w, map[string]string{"error": "Internal Server Error"}, http.StatusInternalServerError)
	}
}

// DeleteAccount godoc
//
// @Summary Delete account
// @Description Permanently delete the signed-in user's account and all of their data
// @Description (tasks, sub-tasks, categories, completions, Quran data, push tokens).
// @Description Requires the password. Admin accounts can't be deleted here.
// @Tags Users
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body DeleteAccountRequest true "Password confirmation"
// @Success 200 {object} SuccessResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Failure 429 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /users/me [delete]
func (h *Handler) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	userID, ok := middlewares.UserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	var req DeleteAccountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, map[string]string{"error": "Invalid request"}, http.StatusBadRequest)
		return
	}
	if req.Password == "" {
		util.SendError(w, map[string]string{"error": "Password is required"}, http.StatusBadRequest)
		return
	}

	if rejectIfRateLimited(w, rateLimitCheck{h.limiters.deleteAccountByUID, userKey(userID)}) {
		return
	}

	err := h.userRepo.DeleteAccount(userID, req.Password)
	switch {
	case err == nil:
		util.SendData(w, SuccessResponse{Message: "Your account has been deleted"}, http.StatusOK)
	case errors.Is(err, util.ErrCurrentPasswordIncorrect):
		util.SendError(w, map[string]string{"error": "Your password is incorrect"}, http.StatusBadRequest)
	case errors.Is(err, util.ErrAdminCannotDeleteAccount):
		util.SendError(w, map[string]string{"error": err.Error()}, http.StatusForbidden)
	case errors.Is(err, util.ErrUserNotFound):
		unauthorized(w)
	default:
		slog.Error("delete account failed", "user_id", userID, "error", err)
		util.SendError(w, map[string]string{"error": "Internal Server Error"}, http.StatusInternalServerError)
	}
}
