package repo

import (
	"errors"
	"strings"

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

// pgConstraint returns the violated constraint's name, if err carries one.
func pgConstraint(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.ConstraintName
	}
	return ""
}

// isDuplicateUUID reports a unique violation on a row's uuid column
// (tasks_uuid_key, categories_uuid_key, ...). For a /sync push that means
// this exact change was already inserted - by an overlapping request, or by
// a retry whose first attempt actually committed before the connection
// dropped - so the caller treats it as success instead of an error.
func isDuplicateUUID(err error) bool {
	return isUniqueViolation(err) && strings.HasSuffix(pgConstraint(err), "_uuid_key")
}
