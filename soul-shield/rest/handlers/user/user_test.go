package user

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"soulsheld/config"
	"soulsheld/repo"
	"soulsheld/rest/middlewares"
	"soulsheld/util"
	"strings"
	"testing"
)

// fakeUserRepo implements repo.UserRepo in memory for handler tests.
type fakeUserRepo struct {
	findErr     error
	changeErr   error
	deleteErr   error
	resetErr    error
	changeCalls int
	deleteCalls int
	resetCalls  int
	// tokenVersion is the account's current version (bumped by change/reset).
	tokenVersion int
}

func (f *fakeUserRepo) Create(u repo.User) (*repo.User, error) {
	u.ID = 1
	u.Password = "$2a$10$this-is-a-bcrypt-hash-that-must-never-leak"
	return &u, nil
}
func (f *fakeUserRepo) Find(email, password string) (*repo.User, error) {
	if f.findErr != nil {
		return nil, f.findErr
	}
	return &repo.User{ID: 1, Full_Name: "Test", Email: email, Role: "user"}, nil
}
func (f *fakeUserRepo) GetByID(id int64) (*repo.User, error) { return &repo.User{ID: id}, nil }
func (f *fakeUserRepo) SessionState(userID int64) (string, int, error) {
	return "user", f.tokenVersion, nil
}
func (f *fakeUserRepo) ResetPassword(email string, expectedVersion int, newPassword string) error {
	f.resetCalls++
	if f.resetErr != nil {
		return f.resetErr
	}
	if expectedVersion != f.tokenVersion {
		return util.ErrInvalidResetToken
	}
	f.tokenVersion++
	return nil
}
func (f *fakeUserRepo) VerifySecurityAnswer(email, answer, ip string) (int, error) {
	return f.tokenVersion, nil
}
func (f *fakeUserRepo) ChangePassword(userID int64, current, next string) (*repo.User, error) {
	f.changeCalls++
	if f.changeErr != nil {
		return nil, f.changeErr
	}
	f.tokenVersion++
	return &repo.User{ID: userID, Full_Name: "Test", Email: "t@example.com", Role: "user", TokenVersion: f.tokenVersion}, nil
}
func (f *fakeUserRepo) DeleteAccount(userID int64, password string) error {
	f.deleteCalls++
	return f.deleteErr
}

func newTestHandler(r *fakeUserRepo) *Handler {
	cnf := &config.Config{SecretKey: "test-secret"}
	return NewHandler(cnf, r, nil, nil)
}

func jsonRequest(method, path string, body any) *http.Request {
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(method, path, bytes.NewReader(raw))
	req.RemoteAddr = "203.0.113.7:1234"
	return req
}

// asUser simulates AuthenticateJWT having run.
func asUser(req *http.Request, userID int64) *http.Request {
	return req.WithContext(middlewares.WithUser(req.Context(), userID, "user"))
}

func errorBody(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("response is not a JSON object: %q", rec.Body.String())
	}
	return body["error"]
}

func TestRegisterResponseNeverContainsPassword(t *testing.T) {
	h := newTestHandler(&fakeUserRepo{})
	rec := httptest.NewRecorder()
	h.CreateUser(rec, jsonRequest("POST", "/users/register", map[string]string{
		"full_name": "Test", "email": "t@example.com", "password": "secret123", "security_answer": "blue bird",
	}))

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201 (%s)", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	if strings.Contains(body, "password") || strings.Contains(body, "$2a$") {
		t.Fatalf("register response leaks the password/hash: %s", body)
	}
	if !strings.Contains(body, `"email":"t@example.com"`) {
		t.Fatalf("register response missing email: %s", body)
	}
}

func TestLoginUnknownEmailAndWrongPasswordLookIdentical(t *testing.T) {
	for name, repoErr := range map[string]error{
		"unknown email":  util.ErrUserNotFound,
		"wrong password": util.ErrInvalidCredentials,
	} {
		h := newTestHandler(&fakeUserRepo{findErr: repoErr})
		rec := httptest.NewRecorder()
		h.Login(rec, jsonRequest("POST", "/users/login", map[string]string{"email": "x@example.com", "password": "nope"}))

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("%s: status = %d, want 401", name, rec.Code)
		}
		if got := errorBody(t, rec); got != util.ErrInvalidCredentials.Error() {
			t.Errorf("%s: error = %q", name, got)
		}
	}
}

func TestLoginIsRateLimitedPerEmail(t *testing.T) {
	h := newTestHandler(&fakeUserRepo{findErr: util.ErrInvalidCredentials})
	var last *httptest.ResponseRecorder
	for i := 0; i < 11; i++ {
		last = httptest.NewRecorder()
		req := jsonRequest("POST", "/users/login", map[string]string{"email": "Victim@Example.com ", "password": "guess"})
		req.RemoteAddr = "198.51.100." + string(rune('1'+i%9)) + ":1" // different IPs
		h.Login(last, req)
	}
	if last.Code != http.StatusTooManyRequests {
		t.Fatalf("11th attempt for one email: status = %d, want 429", last.Code)
	}
	if last.Header().Get("Retry-After") == "" {
		t.Fatal("429 response should carry Retry-After")
	}
}

func TestChangePassword(t *testing.T) {
	t.Run("rejects a too-short new password before touching the repo", func(t *testing.T) {
		fake := &fakeUserRepo{}
		rec := httptest.NewRecorder()
		newTestHandler(fake).ChangePassword(rec, asUser(jsonRequest("POST", "/users/change-password",
			map[string]string{"current_password": "old-pass", "new_password": "123"}), 5))
		if rec.Code != http.StatusBadRequest || fake.changeCalls != 0 {
			t.Fatalf("status = %d, repo calls = %d", rec.Code, fake.changeCalls)
		}
	})

	t.Run("wrong current password is 400, never 401 (mobile signs out on 401)", func(t *testing.T) {
		rec := httptest.NewRecorder()
		newTestHandler(&fakeUserRepo{changeErr: util.ErrCurrentPasswordIncorrect}).ChangePassword(rec,
			asUser(jsonRequest("POST", "/users/change-password",
				map[string]string{"current_password": "wrong", "new_password": "new-pass-1"}), 5))
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", rec.Code)
		}
	})

	t.Run("success returns a new token carrying the bumped version", func(t *testing.T) {
		rec := httptest.NewRecorder()
		newTestHandler(&fakeUserRepo{tokenVersion: 3}).ChangePassword(rec, asUser(jsonRequest("POST", "/users/change-password",
			map[string]string{"current_password": "old-pass", "new_password": "new-pass-1"}), 5))
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", rec.Code)
		}
		var body ChangePasswordResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil || body.Token == "" {
			t.Fatalf("expected a token in %q", rec.Body.String())
		}
		claims, err := util.VerifyJWT("test-secret", body.Token)
		if err != nil {
			t.Fatalf("returned token doesn't verify: %v", err)
		}
		if claims.ID != 5 || claims.TokenVersion != 4 {
			t.Fatalf("claims = id %d ver %d, want id 5 ver 4", claims.ID, claims.TokenVersion)
		}
	})

	t.Run("requires authentication", func(t *testing.T) {
		rec := httptest.NewRecorder()
		newTestHandler(&fakeUserRepo{}).ChangePassword(rec, jsonRequest("POST", "/users/change-password",
			map[string]string{"current_password": "a", "new_password": "new-pass-1"}))
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, want 401", rec.Code)
		}
	})
}

func TestDeleteAccount(t *testing.T) {
	cases := []struct {
		name     string
		repoErr  error
		password string
		want     int
	}{
		{"success", nil, "pw", http.StatusOK},
		{"wrong password", util.ErrCurrentPasswordIncorrect, "pw", http.StatusBadRequest},
		{"admins can't self-delete", util.ErrAdminCannotDeleteAccount, "pw", http.StatusForbidden},
		{"password required", nil, "", http.StatusBadRequest},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			newTestHandler(&fakeUserRepo{deleteErr: c.repoErr}).DeleteAccount(rec,
				asUser(jsonRequest("DELETE", "/users/me", map[string]string{"password": c.password}), 9))
			if rec.Code != c.want {
				t.Fatalf("status = %d, want %d (%s)", rec.Code, c.want, rec.Body.String())
			}
		})
	}
}

func TestRegisterValidatesInput(t *testing.T) {
	valid := map[string]string{"full_name": "Test", "email": "t@example.com", "password": "secret123", "security_answer": "blue bird"}
	cases := []struct {
		name  string
		field string
		value string
	}{
		{"empty name", "full_name", "   "},
		{"name over 100 characters", "full_name", strings.Repeat("a", 101)},
		{"malformed email", "email", "not-an-email"},
		{"email without a domain dot", "email", "a@localhost"},
		{"password too short", "password", "12345"},
		{"password over bcrypt's 72 bytes", "password", strings.Repeat("p", 73)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			body := map[string]string{}
			for k, v := range valid {
				body[k] = v
			}
			body[tc.field] = tc.value
			rec := httptest.NewRecorder()
			newTestHandler(&fakeUserRepo{}).CreateUser(rec, jsonRequest("POST", "/users/register", body))
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400 (body %s)", rec.Code, rec.Body.String())
			}
		})
	}
}

func TestResetTokenIsSingleUse(t *testing.T) {
	fake := &fakeUserRepo{tokenVersion: 2}
	h := newTestHandler(fake)
	token, err := util.CreateResetPasswordJWT("test-secret", "t@example.com", 2)
	if err != nil {
		t.Fatal(err)
	}
	reset := func() int {
		rec := httptest.NewRecorder()
		h.ResetPassword(rec, jsonRequest("POST", "/users/reset-password",
			map[string]string{"reset_token": token, "new_password": "brand-new-1"}))
		return rec.Code
	}
	if code := reset(); code != http.StatusOK {
		t.Fatalf("first reset: status %d, want 200", code)
	}
	if code := reset(); code != http.StatusUnauthorized {
		t.Fatalf("replayed reset: status %d, want 401", code)
	}
}

func TestResetPasswordValidatesNewPassword(t *testing.T) {
	fake := &fakeUserRepo{}
	token, _ := util.CreateResetPasswordJWT("test-secret", "t@example.com", 0)
	rec := httptest.NewRecorder()
	newTestHandler(fake).ResetPassword(rec, jsonRequest("POST", "/users/reset-password",
		map[string]string{"reset_token": token, "new_password": "123"}))
	if rec.Code != http.StatusBadRequest || fake.resetCalls != 0 {
		t.Fatalf("status = %d, repo calls = %d; want 400 and no repo call", rec.Code, fake.resetCalls)
	}
}
