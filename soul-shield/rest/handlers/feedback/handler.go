// Package feedback receives app ratings + feedback from the mobile app
// (signed in or guest) and serves them to admins in the web panel.
package feedback

import (
	"encoding/json"
	"log/slog"
	"math"
	"net/http"
	"regexp"
	"soulsheld/repo"
	"soulsheld/rest/middlewares"
	"soulsheld/util"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	// One submission per person (account or guest device) per 24 hours.
	Cooldown        = 24 * time.Hour
	maxMessageRunes = 2000
	defaultPageSize = 30
	maxPageSize     = 100
)

var deviceIDPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

type Handler struct {
	repo repo.FeedbackRepo
	now  func() time.Time
	// Submissions are open to guests, so cap them per IP.
	submitByIP *util.RateLimiter
}

func NewHandler(r repo.FeedbackRepo) *Handler {
	return &Handler{repo: r, now: time.Now, submitByIP: util.NewRateLimiter(10, time.Hour)}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux, manager *middlewares.Manager, mw *middlewares.Middleware) {
	mux.Handle("POST /feedback", manager.With(http.HandlerFunc(h.Submit), mw.OptionalAuthenticateJWT))

	admin := func(fn http.HandlerFunc) http.Handler {
		// With() wraps in order, so AuthenticateJWT (last) runs first and
		// sets the role RequireRole checks.
		return manager.With(fn, mw.RequireRole("admin"), mw.AuthenticateJWT)
	}
	mux.Handle("GET /admin/feedback", admin(h.List))
	mux.Handle("GET /admin/feedback/unread-count", admin(h.UnreadCount))
	mux.Handle("POST /admin/feedback/read", admin(h.MarkAllRead))
}

type SubmitRequest struct {
	Rating  int    `json:"rating" example:"5"`
	Message string `json:"message,omitempty" example:"Please add a dark widget"`
	// DeviceID: random UUID the app keeps on the phone. Required for guests
	// (it becomes "guest-user-<n>"), ignored when signed in.
	DeviceID string `json:"device_id,omitempty" example:"3f0c1a52-8e1b-4f7e-9d43-2a1b5c6d7e8f"`
	Platform string `json:"platform,omitempty" example:"android"`
}

type SubmitResponse struct {
	ID int64 `json:"id"`
}

type ListResponse struct {
	Items   []repo.FeedbackItem `json:"items"`
	Summary *repo.RatingSummary `json:"summary"`
	Unread  int                 `json:"unread"`
	// NextBefore: pass as ?before= for the next (older) page; 0 = no more.
	NextBefore int64 `json:"next_before"`
}

type UnreadResponse struct {
	Unread int `json:"unread"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

// CooldownResponse is the 429 for a second submission within 24 hours.
type CooldownResponse struct {
	Error         string    `json:"error"`
	Code          string    `json:"code" example:"feedback_cooldown"`
	NextAllowedAt time.Time `json:"next_allowed_at"`
}

func badRequest(w http.ResponseWriter, msg string) {
	util.SendError(w, map[string]string{"error": msg}, http.StatusBadRequest)
}

func serverError(w http.ResponseWriter, r *http.Request, what string, err error) {
	slog.Error("feedback: "+what, "request_id", middlewares.RequestIDFromContext(r.Context()), "error", err)
	util.SendError(w, map[string]string{"error": "Something went wrong. Please try again."}, http.StatusInternalServerError)
}

// Submit godoc
//
// @Summary Send an app rating + optional feedback
// @Description 1-5 stars plus an optional message (questions, ideas, anything). Works signed in
// @Description (send the JWT) or as a guest (no Authorization header; send device_id). Each person
// @Description counts once in the star totals, with their latest rating. Admins see it in the web panel.
// @Description One submission per person per 24 hours: a second one gets 429 with code "feedback_cooldown"
// @Description and next_allowed_at.
// @Tags Feedback
// @Accept json
// @Produce json
// @Param body body SubmitRequest true "Rating and optional message"
// @Success 201 {object} SubmitResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 429 {object} CooldownResponse
// @Router /feedback [post]
func (h *Handler) Submit(w http.ResponseWriter, r *http.Request) {
	if ok, retryAfter := h.submitByIP.Allow(util.ClientIP(r)); !ok {
		w.Header().Set("Retry-After", strconv.Itoa(int(math.Ceil(retryAfter.Seconds()))))
		util.SendError(w, map[string]string{"error": util.ErrTooManyAttempts.Error()}, http.StatusTooManyRequests)
		return
	}

	var req SubmitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		badRequest(w, "Invalid request body")
		return
	}
	f, msg := validate(req)
	if msg != "" {
		badRequest(w, msg)
		return
	}

	if userID, ok := middlewares.UserID(r); ok {
		f.UserID = &userID
	} else {
		if !deviceIDPattern.MatchString(req.DeviceID) {
			badRequest(w, "device_id is required when not signed in")
			return
		}
		guestID, err := h.repo.GuestDeviceID(strings.ToLower(req.DeviceID))
		if err != nil {
			serverError(w, r, "guest device lookup failed", err)
			return
		}
		f.GuestDeviceID = &guestID
	}

	last, ok, err := h.repo.LastSubmittedAt(f.UserID, f.GuestDeviceID)
	if err != nil {
		serverError(w, r, "last submission lookup failed", err)
		return
	}
	if next := last.Add(Cooldown); ok && h.now().Before(next) {
		w.Header().Set("Retry-After", strconv.Itoa(int(math.Ceil(next.Sub(h.now()).Seconds()))))
		util.SendError(w, CooldownResponse{
			Error:         "You can send feedback once every 24 hours.",
			Code:          "feedback_cooldown",
			NextAllowedAt: next.UTC(),
		}, http.StatusTooManyRequests)
		return
	}

	id, err := h.repo.Create(f)
	if err != nil {
		serverError(w, r, "create failed", err)
		return
	}
	util.SendData(w, SubmitResponse{ID: id}, http.StatusCreated)
}

// validate checks the rating/message/platform and returns the submission
// (without a submitter yet) or a user-facing error message.
func validate(req SubmitRequest) (repo.NewFeedback, string) {
	if req.Rating < 1 || req.Rating > 5 {
		return repo.NewFeedback{}, "Rating must be between 1 and 5"
	}
	f := repo.NewFeedback{Rating: req.Rating}
	if message := strings.TrimSpace(req.Message); message != "" {
		if !utf8.ValidString(message) || utf8.RuneCountInString(message) > maxMessageRunes {
			return repo.NewFeedback{}, "Message must be at most 2000 characters"
		}
		f.Message = &message
	}
	switch platform := strings.ToLower(strings.TrimSpace(req.Platform)); platform {
	case "":
	case "android", "ios", "web":
		f.Platform = &platform
	default:
		other := "other"
		f.Platform = &other
	}
	return f, ""
}

// List godoc
//
// @Summary List ratings and feedback (admin)
// @Description Newest first, plus the 1-5 star totals (one vote per person, their latest rating) and the unread count.
// @Tags Feedback
// @Security BearerAuth
// @Produce json
// @Param limit query int false "Page size (1-100), default 30"
// @Param before query int false "Return items older than this id (from next_before)"
// @Success 200 {object} ListResponse
// @Failure 400 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Router /admin/feedback [get]
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	limit := defaultPageSize
	if v := r.URL.Query().Get("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > maxPageSize {
			badRequest(w, "limit must be between 1 and 100")
			return
		}
		limit = n
	}
	var before int64
	if v := r.URL.Query().Get("before"); v != "" {
		n, err := strconv.ParseInt(v, 10, 64)
		if err != nil || n < 1 {
			badRequest(w, "Invalid 'before'")
			return
		}
		before = n
	}

	items, err := h.repo.List(limit+1, before)
	if err != nil {
		serverError(w, r, "list failed", err)
		return
	}
	resp := ListResponse{Items: items}
	if len(items) > limit {
		resp.Items = items[:limit]
		resp.NextBefore = resp.Items[limit-1].ID
	}
	if resp.Summary, err = h.repo.Summary(); err != nil {
		serverError(w, r, "summary failed", err)
		return
	}
	if resp.Unread, err = h.repo.UnreadCount(); err != nil {
		serverError(w, r, "unread count failed", err)
		return
	}
	util.SendData(w, resp, http.StatusOK)
}

// UnreadCount godoc
//
// @Summary Count unseen feedback (admin)
// @Description Drives the admin panel's "new feedback" notification.
// @Tags Feedback
// @Security BearerAuth
// @Produce json
// @Success 200 {object} UnreadResponse
// @Failure 403 {object} ErrorResponse
// @Router /admin/feedback/unread-count [get]
func (h *Handler) UnreadCount(w http.ResponseWriter, r *http.Request) {
	n, err := h.repo.UnreadCount()
	if err != nil {
		serverError(w, r, "unread count failed", err)
		return
	}
	util.SendData(w, UnreadResponse{Unread: n}, http.StatusOK)
}

// MarkAllRead godoc
//
// @Summary Mark all feedback as seen (admin)
// @Description Clears the "new feedback" notification. Called when an admin opens the Feedback page.
// @Tags Feedback
// @Security BearerAuth
// @Success 204
// @Failure 403 {object} ErrorResponse
// @Router /admin/feedback/read [post]
func (h *Handler) MarkAllRead(w http.ResponseWriter, r *http.Request) {
	if err := h.repo.MarkAllRead(); err != nil {
		serverError(w, r, "mark read failed", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
