package user

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"soulsheld/util"
)

// ResetPassword godoc
//
// @Summary Reset Password
// @Description Reset user password using the reset_token issued by /users/verify-security-answer
// @Tags Users
// @Accept json
// @Produce json
// @Param body body ResetPasswordRequest true "Password Reset Information"
// @Success 200 {object} SuccessResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 429 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /users/reset-password [post]
func (h *Handler) ResetPassword(w http.ResponseWriter, r *http.Request) {

	var req ResetPasswordRequest

	err := json.NewDecoder(r.Body).Decode(&req)

	if err != nil {
		util.SendError(
			w,
			map[string]string{
				"error": "Invalid request",
			},
			http.StatusBadRequest,
		)

		return
	}

	// The reset_token is only issued after a successful
	// /users/verify-security-answer call (see verify_security_answer.go), so
	// its presence + validity IS the identity check here.
	if err := util.ValidateNewPassword(req.NewPassword); err != nil {
		util.SendError(w, map[string]string{"error": err.Error()}, http.StatusBadRequest)
		return
	}

	if rejectIfRateLimited(w, rateLimitCheck{h.limiters.resetPasswordByIP, util.ClientIP(r)}) {
		return
	}

	claims, err := util.VerifyResetPasswordJWT(h.cnf.SecretKey, req.ResetToken)
	if err != nil {
		util.SendError(
			w,
			map[string]string{
				"error": "Invalid or expired reset session. Please verify your security answer again.",
			},
			http.StatusUnauthorized,
		)

		return
	}

	err = h.userRepo.ResetPassword(claims.Email, claims.TokenVersion, req.NewPassword)
	switch {
	case err == nil:
	case errors.Is(err, util.ErrInvalidResetToken):
		// Already used (the first reset bumped token_version), or the account
		// changed its password since the token was issued.
		util.SendError(w, map[string]string{
			"error": "This reset link has already been used. Please verify your security answer again.",
		}, http.StatusUnauthorized)
		return
	default:
		slog.Error("reset password failed", "error", err)
		util.SendError(w, map[string]string{"error": "Internal Server Error"}, http.StatusInternalServerError)
		return
	}

	util.SendData(
		w,
		map[string]string{
			"message": "Password updated successfully",
		},
		http.StatusOK,
	)
}
