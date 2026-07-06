package util

import "errors"

var (
	ErrEmailNotVerified = errors.New("Email not verified")
	ErrOTPNotFound      = errors.New("OTP not found")
	ErrUserExists       = errors.New("User already exists")
	ErrUserNotFound     = errors.New("User Not Found with this email")
	ErrTaskNotFound     = errors.New("Task not found")

	ErrForbidden          = errors.New("You do not have permission to perform this action")
	ErrInvalidRecurrence  = errors.New("recurrence_days cannot be empty for this recurrence_type")
	ErrTaskNotScheduled   = errors.New("this task is not scheduled for the given date")
)
