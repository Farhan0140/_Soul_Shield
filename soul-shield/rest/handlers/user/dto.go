package user

type RegisterRequest struct {
	Full_Name      string `json:"full_name"`
	Email          string `json:"email"`
	Password       string `json:"password"`
	SecurityAnswer string `json:"security_answer" example:"Bluebird"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// VerifySecurityAnswerRequest is step 1 of the password-reset flow: prove you know the
// security answer set at registration before you're allowed to pick a new password.
type VerifySecurityAnswerRequest struct {
	Email          string `json:"email" example:"user@gmail.com"`
	SecurityAnswer string `json:"security_answer" example:"Bluebird"`
}

type VerifySecurityAnswerResponse struct {
	Message    string `json:"message"`
	ResetToken string `json:"reset_token"`
}

// ResetPasswordRequest is step 2: the reset_token returned by a successful
// /users/verify-security-answer call proves identity, so no email/OTP is needed here.
type ResetPasswordRequest struct {
	ResetToken  string `json:"reset_token"`
	NewPassword string `json:"new_password" example:"Password@123"`
}

type SuccessResponse struct {
	Message string `json:"message"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}
