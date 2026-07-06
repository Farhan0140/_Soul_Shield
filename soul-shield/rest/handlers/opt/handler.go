package otp

import "soulsheld/repo"

type Handler struct {
	otpRepo repo.OTPRepo
}

func NewHandler(
	otpRepo repo.OTPRepo,
) *Handler {
	return &Handler{
		otpRepo: otpRepo,
	}
}