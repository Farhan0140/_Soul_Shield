package middlewares

import (
	"net/http"
	"net/http/httptest"
	"soulsheld/config"
	"soulsheld/util"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "test-secret-that-is-at-least-32-bytes!"

type fakeSessions struct {
	info *SessionInfo
	err  error
}

func (f fakeSessions) SessionInfo(int64) (*SessionInfo, error) { return f.info, f.err }

func protected(sessions SessionStore) (http.Handler, *string) {
	var seenRole string
	mw := NewMiddleware(&config.Config{SecretKey: testSecret}, sessions)
	return mw.AuthenticateJWT(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seenRole = Role(r)
		w.WriteHeader(http.StatusNoContent)
	})), &seenRole
}

func call(h http.Handler, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest("GET", "/users/me", nil)
	if token != "" {
		req.Header.Set("Authorization", "JWT "+token)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func mustToken(t *testing.T, claims util.CustomClaims) string {
	t.Helper()
	tok, err := util.CreateJWT(testSecret, claims)
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

func TestAuthenticateJWT(t *testing.T) {
	live := fakeSessions{info: &SessionInfo{Role: "admin", TokenVersion: 2}}

	t.Run("current version passes and the role comes from the database", func(t *testing.T) {
		h, role := protected(live)
		rec := call(h, mustToken(t, util.CustomClaims{ID: 7, Role: "user", TokenVersion: 2}))
		if rec.Code != http.StatusNoContent {
			t.Fatalf("status %d, want 204", rec.Code)
		}
		if *role != "admin" {
			t.Fatalf("role = %q, want the DB role \"admin\" (not the token's \"user\")", *role)
		}
		if rec.Header().Get(util.RefreshedTokenHeader) != "" {
			t.Fatal("a fresh token must not be renewed")
		}
	})

	t.Run("token from before a password change is revoked", func(t *testing.T) {
		h, _ := protected(live)
		if rec := call(h, mustToken(t, util.CustomClaims{ID: 7, TokenVersion: 1})); rec.Code != http.StatusUnauthorized {
			t.Fatalf("status %d, want 401", rec.Code)
		}
	})

	t.Run("deleted account is signed out", func(t *testing.T) {
		h, _ := protected(fakeSessions{err: util.ErrUserNotFound})
		if rec := call(h, mustToken(t, util.CustomClaims{ID: 7})); rec.Code != http.StatusUnauthorized {
			t.Fatalf("status %d, want 401", rec.Code)
		}
	})

	t.Run("database failure is 503, never 401", func(t *testing.T) {
		h, _ := protected(fakeSessions{err: http.ErrHandlerTimeout})
		if rec := call(h, mustToken(t, util.CustomClaims{ID: 7})); rec.Code != http.StatusServiceUnavailable {
			t.Fatalf("status %d, want 503", rec.Code)
		}
	})

	t.Run("a password-reset token is not a session", func(t *testing.T) {
		h, _ := protected(fakeSessions{info: &SessionInfo{Role: "user"}})
		reset, _ := util.CreateResetPasswordJWT(testSecret, "t@example.com", 0)
		if rec := call(h, reset); rec.Code != http.StatusUnauthorized {
			t.Fatalf("status %d, want 401", rec.Code)
		}
	})

	t.Run("alg none is refused", func(t *testing.T) {
		h, _ := protected(fakeSessions{info: &SessionInfo{Role: "user"}})
		unsigned := jwt.NewWithClaims(jwt.SigningMethodNone, util.CustomClaims{ID: 7, Type: "auth",
			RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))}})
		tok, err := unsigned.SignedString(jwt.UnsafeAllowNoneSignatureType)
		if err != nil {
			t.Fatal(err)
		}
		if rec := call(h, tok); rec.Code != http.StatusUnauthorized {
			t.Fatalf("status %d, want 401", rec.Code)
		}
	})

	t.Run("old token gets a renewed one in the response header", func(t *testing.T) {
		h, _ := protected(fakeSessions{info: &SessionInfo{Role: "user", TokenVersion: 0}})
		old := jwt.NewWithClaims(jwt.SigningMethodHS256, util.CustomClaims{ID: 7, Type: "auth",
			RegisteredClaims: jwt.RegisteredClaims{
				IssuedAt:  jwt.NewNumericDate(time.Now().Add(-3 * 24 * time.Hour)),
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			}})
		tok, _ := old.SignedString([]byte(testSecret))
		rec := call(h, tok)
		if rec.Code != http.StatusNoContent {
			t.Fatalf("status %d, want 204", rec.Code)
		}
		renewed := rec.Header().Get(util.RefreshedTokenHeader)
		claims, err := util.VerifyJWT(testSecret, renewed)
		if err != nil || claims.ID != 7 {
			t.Fatalf("renewed token invalid: %v", err)
		}
	})

	t.Run("missing or malformed header", func(t *testing.T) {
		h, _ := protected(live)
		if rec := call(h, ""); rec.Code != http.StatusUnauthorized {
			t.Fatalf("status %d, want 401", rec.Code)
		}
	})
}

func TestRecoverAndRequestID(t *testing.T) {
	h := RequestLogger(Recover(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("boom")
	})))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/x", nil))
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status %d, want 500", rec.Code)
	}
	if rec.Header().Get(RequestIDHeader) == "" {
		t.Fatal("response is missing X-Request-ID")
	}
}

func TestLimitBody(t *testing.T) {
	h := LimitBody(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) }))
	req := httptest.NewRequest("POST", "/sync", nil)
	req.ContentLength = MaxRequestBodyBytes + 1
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status %d, want 413", rec.Code)
	}
}
