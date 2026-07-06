package otp

import (
	"net/http"
)

func (h *Handler) RegisterRoutes(
	mux *http.ServeMux,
) {
	mux.HandleFunc(
		"/send-otp",
		h.SendOTP,
	)

	mux.HandleFunc(
		"/verify-otp",
		h.VerifyOTP,
	)
}