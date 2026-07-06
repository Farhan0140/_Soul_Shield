package util

import "errors"

var (
	ErrEmailNotVerified = errors.New("Email not verified")
	ErrOTPNotFound      = errors.New("OTP not found")
	ErrUserExists       = errors.New("User already exists")
	ErrUserNotFound     = errors.New("User Not Found with this email")
	ErrTaskNotFound     = errors.New("Task not found")
)
