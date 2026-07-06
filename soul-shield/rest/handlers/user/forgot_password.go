package user

import (
	"encoding/json"
	"net/http"
	"soulsheld/util"
)

var req struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// ResetPassword godoc
//
// @Summary Reset Password
// @Description Reset user password after successful OTP verification
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

	verified, err := h.otpRepo.IsVerified(
		req.Email,
	)

	if err != nil {
		util.SendError(
			w,
			map[string]string{
				"error": "Email verification required",
			},
			http.StatusBadRequest,
		)

		return
	}

	if !verified {
		util.SendError(
			w,
			map[string]string{
				"error": "OTP not verified",
			},
			http.StatusBadRequest,
		)

		return
	}

	err = h.userRepo.Update(
		req.Email,
		req.Password,
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