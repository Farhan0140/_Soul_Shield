package otp

type SendOtpRequest struct {
	Email string `json:"email" example:"user@gmail.com"`
}

type VerifyOtpRequest struct {
	Email string `json:"email" example:"user@gmail.com"`
	OTP   string `json:"otp" example:"123456"`
}

type SuccessResponse struct {
	Success bool   `json:"success" example:"true"`
	Message string `json:"message" example:"OTP sent successfully"`
}

type ErrorResponse struct {
	Error string `json:"error" example:"invalid request"`
}