package category

import (
	"soulsheld/util"
	"strings"
	"unicode/utf8"
)

// validateName mirrors the categories.name column: non-empty, at most 100
// characters. Returns the trimmed name.
func validateName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", util.ErrCategoryNameRequired
	}
	if utf8.RuneCountInString(name) > 100 {
		return "", util.ErrCategoryNameTooLong
	}
	return name, nil
}
