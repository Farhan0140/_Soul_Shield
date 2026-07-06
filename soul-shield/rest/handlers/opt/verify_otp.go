package otp

import (
	"encoding/json"
	"net/http"
)

type VerifyOTPRequest struct {
	Email string `json:"email"`
	OTP   string `json:"otp"`
}

// VerifyOTP godoc
//
// @Summary Verify OTP
// @Description Verify user email using OTP code
// @Tags OTP
// @Accept json
// @Produce json
// @Param body body VerifyOTPRequest true "OTP Verification Information"
// @Success 200 {object} SuccessResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /verify-otp [post]
func (h *Handler) VerifyOTP(
	w http.ResponseWriter,
	r *http.Request,
) {

	if r.Method != http.MethodPost {

		http.Error(
			w,
			"Method Not Allowed",
			http.StatusMethodNotAllowed,
		)
		return
	}

	var req VerifyOTPRequest

	err := json.NewDecoder(
		r.Body,
	).Decode(
		&req,
	)

	if err != nil {

		http.Error(
			w,
			"Invalid Request Body",
			http.StatusBadRequest,
		)
		return
	}

	if req.Email == "" || req.OTP == "" {

		http.Error(
			w,
			"Email and OTP required",
			http.StatusBadRequest,
		)
		return
	}

	ok, err := h.otpRepo.VerifyOTP(
		req.Email,
		req.OTP,
	)

	if err != nil {

		http.Error(
			w,
			"Verification Failed",
			http.StatusInternalServerError,
		)
		return
	}

	if !ok {

		http.Error(
			w,
			"Invalid or expired OTP",
			http.StatusBadRequest,
		)
		return
	}

	w.Header().Set(
		"Content-Type",
		"application/json",
	)

	json.NewEncoder(w).Encode(
		map[string]any{
			"success": true,
			"message": "OTP verified successfully",
		},
	)
}
