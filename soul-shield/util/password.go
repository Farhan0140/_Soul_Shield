package util

// ValidateNewPassword enforces the minimum rules for a password the user is
// choosing. 6 matches the web client's existing rule; 72 is bcrypt's hard
// input limit (longer inputs make bcrypt return an error).
func ValidateNewPassword(password string) error {
	if len(password) < 6 {
		return ErrPasswordTooShort
	}
	if len(password) > 72 {
		return ErrPasswordTooLong
	}
	return nil
}
