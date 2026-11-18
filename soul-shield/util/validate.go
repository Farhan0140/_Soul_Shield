package util

import (
	"net/mail"
	"strings"
	"unicode/utf8"
)

// Limits shared by the API and (mirrored in) both clients' forms.
const (
	MaxFullNameLength = 100 // users.full_name is VARCHAR(100)
	MaxEmailLength    = 255 // users.email is VARCHAR(255)
)

// ValidateFullName expects an already-trimmed name.
func ValidateFullName(name string) error {
	if name == "" {
		return ErrFullNameRequired
	}
	if utf8.RuneCountInString(name) > MaxFullNameLength {
		return ErrFullNameTooLong
	}
	return nil
}

// ValidateEmail expects an already-trimmed, lowercased address. It accepts a
// bare "local@domain.tld" only (no display name, no <brackets>).
func ValidateEmail(email string) error {
	if email == "" || len(email) > MaxEmailLength {
		return ErrInvalidEmail
	}
	addr, err := mail.ParseAddress(email)
	if err != nil || addr.Address != email || addr.Name != "" {
		return ErrInvalidEmail
	}
	at := strings.LastIndexByte(email, '@')
	if at < 1 || !strings.Contains(email[at+1:], ".") {
		return ErrInvalidEmail
	}
	return nil
}
