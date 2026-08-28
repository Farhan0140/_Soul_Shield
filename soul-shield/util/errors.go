package util

import "errors"

var (
	ErrEmailNotVerified = errors.New("Email not verified")
	ErrOTPNotFound      = errors.New("OTP not found")
	ErrUserExists       = errors.New("User already exists")
	ErrUserNotFound     = errors.New("User Not Found with this email")
	ErrTaskNotFound     = errors.New("Task not found")

	ErrForbidden         = errors.New("You do not have permission to perform this action")
	ErrInvalidRecurrence = errors.New("recurrence_days cannot be empty for this recurrence_type")
	ErrTaskNotScheduled  = errors.New("this task is not scheduled for the given date")
	ErrTaskNotGlobal     = errors.New("only fixed tasks can be added to your own tasks")

	ErrCategoryExists   = errors.New("Category with this name already exists")
	ErrCategoryNotFound = errors.New("Category not found")

	ErrInvalidCounterTarget = errors.New("counter task requires target_count > 0")
	ErrNotCounterTask       = errors.New("this endpoint is only for counter type tasks")

	ErrInvalidTimerDuration = errors.New("timer task requires duration_seconds > 0")

	ErrInvalidReminderTime = errors.New("reminder_time must be in HH:MM 24-hour format")

	ErrInvalidIncrementAmount = errors.New("increment amount must be greater than 0")

	ErrSubTaskNotFound      = errors.New("Sub-task not found")
	ErrSubTaskTitleRequired = errors.New("sub-task title is required")

	ErrSecurityAnswerMismatch = errors.New("security answer is incorrect")
	ErrSecurityAnswerNotSet   = errors.New("security answer not set for this account")
	ErrSecurityAnswerLocked   = errors.New("too many failed attempts, verification temporarily locked")
	ErrInvalidResetToken      = errors.New("invalid or expired reset token")
)
