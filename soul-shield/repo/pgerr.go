package repo

import (
	"errors"
	"fmt"
	"soulsheld/util"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/lib/pq"
)

// pgErrCode returns the SQLSTATE of a Postgres error ("" if err isn't one).
//
// The app connects through pgx (infra/db), whose errors are *pgconn.PgError -
// NOT *pq.Error. Checks written as `err.(*pq.Error)` therefore never
// matched: a duplicate email, category or bookmark surfaced as a generic 500
// instead of the intended 409, and a duplicate category in a /sync push
// aborted the whole batch instead of being rejected on its own. *pq.Error is
// still recognised as a fallback in case the driver is ever switched.
func pgErrCode(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code
	}
	var pqErr *pq.Error
	if errors.As(err, &pqErr) {
		return string(pqErr.Code)
	}
	return ""
}

func isUniqueViolation(err error) bool {
	return pgErrCode(err) == "23505"
}

// isIntegrityViolation reports SQLSTATE class 23 (not-null, foreign-key,
// unique, check): the data itself was unacceptable, as opposed to the
// database being unreachable or broken.
func isIntegrityViolation(err error) bool {
	code := pgErrCode(err)
	return len(code) == 5 && code[:2] == "23"
}

// isDataException reports SQLSTATE class 22 (data exception): a value the
// database couldn't even parse or store, e.g. an invalid date ("2026-13-45"),
// a malformed uuid, or a number out of range. Like class 23 it is a problem
// with ONE change's data, not with the database.
func isDataException(err error) bool {
	code := pgErrCode(err)
	return len(code) == 5 && code[:2] == "22"
}

// isRejectableDataError reports whether err means "this one change's data is
// unacceptable" (class 22 or 23) - which /sync push answers with a
// per-change "rejected" - as opposed to an infrastructure failure, which
// fails the whole request so the client retries it later.
func isRejectableDataError(err error) bool {
	return isIntegrityViolation(err) || isDataException(err)
}

// asInputError turns "the database refused this data" (SQLSTATE class 22 or a
// non-unique class 23) into util.ErrInvalidInput, keeping the original error
// wrapped for logging; anything else is returned unchanged.
func asInputError(err error) error {
	if err == nil || isUniqueViolation(err) || !isRejectableDataError(err) {
		return err
	}
	return fmt.Errorf("%w: %w", util.ErrInvalidInput, err)
}

// rejectionDetail names what was wrong for a rejected sync change: the
// violated constraint when there is one (class 23), else the SQLSTATE
// (class 22 errors carry no constraint name).
func rejectionDetail(err error) string {
	if c := pgConstraint(err); c != "" {
		return c
	}
	return "SQLSTATE " + pgErrCode(err)
}

// pgConstraint returns the violated constraint's name, if err carries one.
func pgConstraint(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.ConstraintName
	}
	return ""
}
