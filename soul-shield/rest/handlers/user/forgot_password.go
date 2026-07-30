package user

import (
	"encoding/json"
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

	// The reset_token is only issued after a successful /users/verify-security-answer call
	// (see verify_security_answer.go), so its presence + validity IS the identity check here —
	// this replaced the old commented-out OTP-verified check below.
	// verified, err := h.otpRepo.IsVerified(
	// 	req.Email,
	// )

	// if err != nil {
	// 	util.SendError(
	// 		w,
	// 		map[string]string{
	// 			"error": "Email verification required",
	// 		},
	// 		http.StatusBadRequest,
	// 	)

	// 	return
	// }

	// if !verified {
	// 	util.SendError(
	// 		w,
	// 		map[string]string{
	// 			"error": "OTP not verified",
	// 		},
	// 		http.StatusBadRequest,
	// 	)

	// 	return
	// }

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

	err = h.userRepo.Update(
		claims.Email,
		req.NewPassword,
	)

	if err != nil {
		util.SendError(
			w,
			map[string]string{
				"error": err.Error(),
			},
			http.StatusBadRequest,
		)

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