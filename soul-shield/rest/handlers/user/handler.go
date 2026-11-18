package user

import (
	"math"
	"net/http"
	"soulsheld/config"
	"soulsheld/repo"
	"soulsheld/rest/middlewares"
	"soulsheld/util"
	"strconv"
	"strings"
	"time"
)

// authLimiters throttle the auth endpoints (see util.RateLimiter). Each
// endpoint is limited per client IP, and endpoints that take an email or act
// on a signed-in user are ALSO limited per email/user: the IP comes from
// X-Forwarded-For and can be spoofed, the email/user key can't.
type authLimiters struct {
	loginByIP           *util.RateLimiter
	loginByEmail        *util.RateLimiter
	registerByIP        *util.RateLimiter
	verifyAnswerByIP    *util.RateLimiter
	resetPasswordByIP   *util.RateLimiter
	changePasswordByUID *util.RateLimiter
	deleteAccountByUID  *util.RateLimiter
}

func newAuthLimiters() *authLimiters {
	return &authLimiters{
		// Generous per-IP limits: several people can share one IP (mobile
		// carrier NAT, a household).
		loginByIP:    util.NewRateLimiter(30, 15*time.Minute),
		loginByEmail: util.NewRateLimiter(10, 15*time.Minute),
		registerByIP: util.NewRateLimiter(10, time.Hour),
		// verify-security-answer also has its own per-email lockout
		// (5 failures -> 24h) in repo.VerifySecurityAnswer.
		verifyAnswerByIP:    util.NewRateLimiter(20, 15*time.Minute),
		resetPasswordByIP:   util.NewRateLimiter(10, 15*time.Minute),
		changePasswordByUID: util.NewRateLimiter(10, 15*time.Minute),
		deleteAccountByUID:  util.NewRateLimiter(5, 15*time.Minute),
	}
}

type Handler struct {
	cnf         *config.Config
	userRepo    repo.UserRepo
	pushRepo    repo.PushRepo
	middlewares *middlewares.Middleware
	limiters    *authLimiters
}

func NewHandler(
	cnf *config.Config,
	userRepo repo.UserRepo,
	pushRepo repo.PushRepo,
	middlewares *middlewares.Middleware,
) *Handler {
	return &Handler{
		cnf:         cnf,
		userRepo:    userRepo,
		pushRepo:    pushRepo,
		middlewares: middlewares,
		limiters:    newAuthLimiters(),
	}
}

// rateLimitCheck is one limiter + the key to count the request against.
type rateLimitCheck struct {
	limiter *util.RateLimiter
	key     string
}

// rejectIfRateLimited counts the request against every check and, if any is
// over its limit, answers 429 (with Retry-After) and returns true. Checks with
// an empty key are skipped.
func rejectIfRateLimited(w http.ResponseWriter, checks ...rateLimitCheck) bool {
	var wait time.Duration
	limited := false
	for _, c := range checks {
		if c.key == "" {
			continue
		}
		if ok, retryAfter := c.limiter.Allow(c.key); !ok {
			limited = true
			if retryAfter > wait {
				wait = retryAfter
			}
		}
	}
	if !limited {
		return false
	}

	w.Header().Set("Retry-After", strconv.Itoa(int(math.Ceil(wait.Seconds()))))
	util.SendError(w, map[string]string{"error": util.ErrTooManyAttempts.Error()}, http.StatusTooManyRequests)
	return true
}

func normalizedEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func userKey(userID int64) string {
	return strconv.FormatInt(userID, 10)
}
