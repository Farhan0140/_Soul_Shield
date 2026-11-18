package user

type RegisterRequest struct {
	Full_Name      string `json:"full_name"`
	Email          string `json:"email"`
	Password       string `json:"password"`
	SecurityAnswer string `json:"security_answer" example:"Bluebird"`
}

// RegisterResponse is the public view of a newly created account. It is a
// separate type (not repo.User) so the password hash can never be serialized.
type RegisterResponse struct {
	ID        int64  `json:"id" example:"1"`
	Full_Name string `json:"full_name" example:"Farhan"`
	Email     string `json:"email" example:"user@gmail.com"`
}

// ChangePasswordRequest changes the signed-in user's password. The current
// password is required so a stolen/unattended session can't silently take
// over the account.
type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password" example:"OldPassword@123"`
	NewPassword     string `json:"new_password" example:"NewPassword@123"`
}

// ChangePasswordResponse carries a fresh session token: the change bumped the
// account's token version, so the token the request was made with (and every
// other device's) is no longer valid. Token is empty only if issuing it
// failed; the client should then send the user to sign in again.
type ChangePasswordResponse struct {
	Message string `json:"message"`
	Token   string `json:"token,omitempty"`
}

// DeleteAccountRequest permanently deletes the signed-in user's account. The
// password re-confirms intent and identity.
type DeleteAccountRequest struct {
	Password string `json:"password" example:"Password@123"`
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
