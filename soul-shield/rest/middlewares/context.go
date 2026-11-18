package middlewares

import (
	"context"
	"net/http"
)

// ctxKey is unexported, so no other package can read or overwrite these
// context values by accident (plain string keys like "userID" could collide).
type ctxKey int

const (
	userIDKey ctxKey = iota
	roleKey
)

// WithUser returns ctx carrying the authenticated user. AuthenticateJWT is the
// only production caller; tests use it to simulate a signed-in request.
func WithUser(ctx context.Context, userID int64, role string) context.Context {
	ctx = context.WithValue(ctx, userIDKey, userID)
	return context.WithValue(ctx, roleKey, role)
}

// UserID is the authenticated user's id; ok is false on routes that didn't
// run AuthenticateJWT.
func UserID(r *http.Request) (id int64, ok bool) {
	id, ok = r.Context().Value(userIDKey).(int64)
	return id, ok
}

// Role is the authenticated user's role as read from the database, or "".
func Role(r *http.Request) string {
	role, _ := r.Context().Value(roleKey).(string)
	return role
}
