package user

import (
	"encoding/json"
	"errors"
	"net/http"
	"soulsheld/util"
	"strings"
)

// VerifySecurityAnswer godoc
//
// @Summary Verify Security Answer
// @Description Step 1 of password reset: verify the security answer set at registration.
// @Description On success, returns a short-lived reset_token to use with /users/reset-password.
// @Tags Users
// @Accept json
// @Produce json
// @Param body body VerifySecurityAnswerRequest true "Email + Security Answer"
// @Success 200 {object} VerifySecurityAnswerResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 429 {object} ErrorResponse
// @Router /users/verify-security-answer [post]
func (h *Handler) VerifySecurityAnswer(w http.ResponseWriter, r *http.Request) {
	var req VerifySecurityAnswerRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, map[string]string{
			"error": "Invalid request",
		}, http.StatusBadRequest)
		return
	}

	email := strings.TrimSpace(strings.ToLower(req.Email))
	answer := strings.TrimSpace(req.SecurityAnswer)

	if email == "" || answer == "" {
		util.SendError(w, map[string]string{
			"error": "Email and security answer are required",
		}, http.StatusBadRequest)
		return
	}

	err := h.userRepo.VerifySecurityAnswer(email, answer, util.ClientIP(r))
	if err != nil {
		switch {
		case errors.Is(err, util.ErrSecurityAnswerLocked):
			util.SendError(w, map[string]string{
				"error": "Too many failed attempts. Please try again later.",
			}, http.StatusTooManyRequests)
			return

		// Never reveal *why* it failed (unknown email, no answer on file, or a wrong
		// answer) — a single generic message avoids leaking which accounts exist or
		// confirming that part of the answer was correct.
		case errors.Is(err, util.ErrUserNotFound),
			errors.Is(err, util.ErrSecurityAnswerNotSet),
			errors.Is(err, util.ErrSecurityAnswerMismatch):
			util.SendError(w, map[string]string{
				"error": "The security answer you entered is incorrect. Please try again.",
			}, http.StatusUnauthorized)
			return

		default:
			util.SendError(w, map[string]string{
				"error": "Internal Server Error",
			}, http.StatusInternalServerError)
			return
		}
	}

	resetToken, err := util.CreateResetPasswordJWT(h.cnf.SecretKey, email)
	if err != nil {
		util.SendError(w, map[string]string{
			"error": "Internal Server Error",
		}, http.StatusInternalServerError)
		return
	}

	util.SendData(w, VerifySecurityAnswerResponse{
		Message:    "Identity verified successfully. You may now reset your password.",
		ResetToken: resetToken,
	}, http.StatusOK)
}
