package otp

import (
	"encoding/json"
	"net/http"
	"soulsheld/util"
)

type SendOTPRequest struct {
	Email string `json:"email"`
}

// SendOTP godoc
//
// @Summary Send OTP
// @Description Send verification OTP to user email address
// @Tags OTP
// @Accept json
// @Produce json
// @Param body body SendOTPRequest true "Email Information"
// @Success 200 {object} SuccessResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /send-otp [post]
func (h *Handler) SendOTP(w http.ResponseWriter, r *http.Request) {

	if r.Method != http.MethodPost {
		http.Error(
			w,
			"Method Not Allowed",
			http.StatusMethodNotAllowed,
		)
		return
	}

	var req SendOTPRequest

	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {

		http.Error(
			w,
			"Invalid Request Body",
			http.StatusBadRequest,
		)
		return
	}

	if req.Email == "" {

		http.Error(
			w,
			"Email is required",
			http.StatusBadRequest,
		)
		return
	}

	otp := util.GenerateOTP()

	err = h.otpRepo.SaveOTP(
		req.Email,
		otp,
	)

	if err != nil {

		http.Error(
			w,
			"Failed to save OTP",
			http.StatusInternalServerError,
		)
		return
	}

	err = util.SendOTPEmail(
		req.Email,
		otp,
	)

	if err != nil {

		http.Error(
			w,
			"Failed to send OTP",
			http.StatusInternalServerError,
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
			"message": "OTP sent successfully",
		},
	)
}