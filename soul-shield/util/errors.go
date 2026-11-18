package util

import "errors"

var (
	ErrEmailNotVerified = errors.New("Email not verified")
	ErrOTPNotFound      = errors.New("OTP not found")
	ErrUserExists       = errors.New("User already exists")
	ErrUserNotFound     = errors.New("User Not Found with this email")
	// Wrong password on login. Deliberately generic (same message for unknown
	// email and bad password) so login can't be used to probe which emails
	// are registered - the handler maps it to 401 with this exact text, and
	// the mobile/web clients surface it as-is.
	ErrInvalidCredentials = errors.New("Incorrect email or password")
	ErrTaskNotFound       = errors.New("Task not found")

	ErrCurrentPasswordIncorrect = errors.New("Your current password is incorrect")
	ErrAdminCannotDeleteAccount = errors.New("Admin accounts can't be deleted from the app")
	ErrFutureDate               = errors.New("You can't record progress for a future date")
	ErrTaskHasSubTasks          = errors.New("This task has sub-tasks; complete those instead")
	ErrTaskNotCompleted         = errors.New("This task isn't completed for that date")
	ErrFullNameRequired         = errors.New("Please enter your name")
	ErrFullNameTooLong          = errors.New("Name must be at most 100 characters")
	ErrInvalidEmail             = errors.New("Please enter a valid email address")
	// B10: input the database would refuse (CHECK / length), rejected up front as 400.
	ErrTitleRequired         = errors.New("Title is required")
	ErrTitleTooLong          = errors.New("Title must be at most 255 characters")
	ErrInvalidRecurrenceType = errors.New("recurrence_type must be 'daily', 'weekly' or 'custom'")
	ErrCategoryNameRequired  = errors.New("Name is required")
	ErrCategoryNameTooLong   = errors.New("Name must be at most 100 characters")
	ErrInvalidPushToken      = errors.New("token must be an Expo push token")
	ErrInvalidPlatform       = errors.New("platform must be 'ios', 'android', 'web' or 'unknown'")
	// ErrInvalidInput: the database refused a value (constraint / data
	// exception) that the handlers didn't catch. Answered as 400; the details
	// are logged, not sent.
	ErrInvalidInput     = errors.New("Some of the values are invalid")
	ErrPasswordTooShort = errors.New("Password must be at least 6 characters")
	ErrPasswordTooLong  = errors.New("Password must be at most 72 characters")
	ErrTooManyAttempts  = errors.New("Too many attempts. Please wait a few minutes and try again.")

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

	ErrEmptyOrder    = errors.New("ordered_ids cannot be empty")
	ErrOrderMismatch = errors.New("ordered_ids does not match the current set of items")

	ErrSecurityAnswerMismatch = errors.New("security answer is incorrect")
	ErrSecurityAnswerNotSet   = errors.New("security answer not set for this account")
	ErrSecurityAnswerLocked   = errors.New("too many failed attempts, verification temporarily locked")
	ErrInvalidResetToken      = errors.New("invalid or expired reset token")

	ErrLastReadNotFound = errors.New("no last-read position saved yet")
	ErrBookmarkExists   = errors.New("this verse is already bookmarked")
	ErrBookmarkNotFound = errors.New("Bookmark not found")

	ErrInvalidSyncResource = errors.New("unknown sync resource")
	ErrInvalidSyncOp       = errors.New("unknown sync op for this resource")
	ErrSyncParentNotFound  = errors.New("referenced parent uuid not found")
	ErrSyncInvalidData     = errors.New("change was rejected: it violates a data rule (e.g. empty title, invalid type/target/recurrence)")
)
