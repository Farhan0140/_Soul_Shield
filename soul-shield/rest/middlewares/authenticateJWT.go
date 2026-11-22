package middlewares

import (
	"errors"
	"log/slog"
	"net/http"
	"soulsheld/util"
	"strings"
)

// SessionInfo is the per-request account state AuthenticateJWT needs from
// the database.
type SessionInfo struct {
	Role         string
	TokenVersion int
}

// SessionStore looks up the live account state for a token's user id. It
// returns util.ErrUserNotFound when the account no longer exists.
type SessionStore interface {
	SessionInfo(userID int64) (*SessionInfo, error)
}

func unauthorizedResponse(w http.ResponseWriter) {
	util.SendError(w, map[string]string{"error": "Unauthorize"}, http.StatusUnauthorized)
}

// AuthenticateJWT accepts "Authorization: JWT <token>" and, beyond the
// signature/expiry check, verifies against the database that:
//   - the account still exists (deleted accounts are signed out everywhere),
//   - the token's version matches users.token_version (a password change or
//     reset revokes every older token),
//
// and takes the role from the database, not the token, so promotions and
// demotions apply immediately. Tokens older than util.RenewAfter get a fresh
// one in the X-Refreshed-Token response header (sliding session).
func (m *Middleware) AuthenticateJWT(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		scheme, token, found := strings.Cut(r.Header.Get("Authorization"), " ")
		if !found || scheme != "JWT" || token == "" {
			unauthorizedResponse(w)
			return
		}

		claims, err := util.VerifyJWT(m.cnf.SecretKey, token)
		if err != nil {
			unauthorizedResponse(w)
			return
		}

		info, err := m.sessions.SessionInfo(claims.ID)
		if err != nil {
			if errors.Is(err, util.ErrUserNotFound) {
				unauthorizedResponse(w)
				return
			}
			// NOT a 401: the mobile app signs the user out on any 401, which
			// would be the wrong reaction to a database hiccup.
			slog.Error("auth: session lookup failed",
				"request_id", RequestIDFromContext(r.Context()), "user_id", claims.ID, "error", err)
			util.SendError(w, map[string]string{"error": "Service temporarily unavailable. Please try again."}, http.StatusServiceUnavailable)
			return
		}
		if info.TokenVersion != claims.TokenVersion {
			unauthorizedResponse(w)
			return
		}

		if util.ShouldRenew(claims) {
			renewed, err := util.CreateJWT(m.cnf.SecretKey, util.CustomClaims{
				ID:           claims.ID,
				Full_Name:    claims.Full_Name,
				Email:        claims.Email,
				Role:         info.Role,
				TokenVersion: info.TokenVersion,
			})
			if err == nil {
				w.Header().Set(util.RefreshedTokenHeader, renewed)
			}
		}

		noteUser(r, claims.ID)
		next.ServeHTTP(w, r.WithContext(WithUser(r.Context(), claims.ID, info.Role)))
	})
}

// OptionalAuthenticateJWT is for endpoints that work with or without an
// account (e.g. guests sending feedback from the mobile app). A request with
// no Authorization header passes through anonymously (UserID reports !ok); a
// request that DOES send one is checked exactly like AuthenticateJWT, so a
// stale or forged token still gets 401 instead of silently becoming a guest.
func (m *Middleware) OptionalAuthenticateJWT(next http.Handler) http.Handler {
	authed := m.AuthenticateJWT(next)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "" {
			next.ServeHTTP(w, r)
			return
		}
		authed.ServeHTTP(w, r)
	})
}
