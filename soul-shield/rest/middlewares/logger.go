package middlewares

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"regexp"
	"runtime/debug"
	"soulsheld/util"
	"time"
)

// RequestIDHeader is echoed on every response (and accepted from a proxy /
// client when well-formed), so a user-reported error can be matched to its
// log line.
const RequestIDHeader = "X-Request-ID"

type requestIDKey struct{}

// RequestIDFromContext returns the id RequestLogger assigned to this request.
func RequestIDFromContext(ctx context.Context) string {
	id, _ := ctx.Value(requestIDKey{}).(string)
	return id
}

var validRequestID = regexp.MustCompile(`^[A-Za-z0-9._-]{8,64}$`)

func newRequestID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "unknown"
	}
	return hex.EncodeToString(b)
}

// statusRecorder captures the status code and size written by the handler.
type statusRecorder struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (s *statusRecorder) WriteHeader(code int) {
	if s.status == 0 {
		s.status = code
	}
	s.ResponseWriter.WriteHeader(code)
}

func (s *statusRecorder) Write(b []byte) (int, error) {
	if s.status == 0 {
		s.status = http.StatusOK
	}
	n, err := s.ResponseWriter.Write(b)
	s.bytes += n
	return n, err
}

// Unwrap lets http.ResponseController reach the underlying writer.
func (s *statusRecorder) Unwrap() http.ResponseWriter { return s.ResponseWriter }

// RequestLogger assigns a request id and writes one structured (JSON, via the
// default slog logger) line per request: method, path, status, duration,
// size, user id (when authenticated) and client IP. It must be the OUTERMOST
// middleware so it also sees the 500 that Recover writes.
func RequestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		id := r.Header.Get(RequestIDHeader)
		if !validRequestID.MatchString(id) {
			id = newRequestID()
		}
		w.Header().Set(RequestIDHeader, id)

		// AuthenticateJWT runs deeper in the chain and can't add to THIS
		// request's context, so it reports the user id back through this
		// holder instead.
		holder := &requestUser{}
		ctx := context.WithValue(r.Context(), requestIDKey{}, id)
		ctx = context.WithValue(ctx, requestUserKey{}, holder)

		rec := &statusRecorder{ResponseWriter: w}
		next.ServeHTTP(rec, r.WithContext(ctx))

		status := rec.status
		if status == 0 {
			status = http.StatusOK
		}
		level := slog.LevelInfo
		switch {
		case status >= 500:
			level = slog.LevelError
		case status >= 400:
			level = slog.LevelWarn
		}
		attrs := []slog.Attr{
			slog.String("request_id", id),
			slog.String("method", r.Method),
			slog.String("path", r.URL.Path),
			slog.Int("status", status),
			slog.Int64("duration_ms", time.Since(start).Milliseconds()),
			slog.Int("bytes", rec.bytes),
			slog.String("ip", util.ClientIP(r)),
		}
		if holder.userID != 0 {
			attrs = append(attrs, slog.Int64("user_id", holder.userID))
		}
		slog.LogAttrs(r.Context(), level, "request", attrs...)
	})
}

type requestUserKey struct{}

type requestUser struct{ userID int64 }

// noteUser records the authenticated user id for the request log line.
func noteUser(r *http.Request, userID int64) {
	if holder, ok := r.Context().Value(requestUserKey{}).(*requestUser); ok {
		holder.userID = userID
	}
}

// Recover turns a handler panic into a logged 500 instead of a dropped
// connection with no context.
func Recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			rec := recover()
			if rec == nil {
				return
			}
			if rec == http.ErrAbortHandler {
				panic(rec)
			}
			slog.Error("panic in handler",
				"request_id", RequestIDFromContext(r.Context()),
				"method", r.Method,
				"path", r.URL.Path,
				"panic", rec,
				"stack", string(debug.Stack()),
			)
			util.SendError(w, map[string]string{"error": "Internal Server Error"}, http.StatusInternalServerError)
		}()
		next.ServeHTTP(w, r)
	})
}

// MaxRequestBodyBytes caps every request body. The largest legitimate body is
// a sync push (≤ MaxSyncBatchChanges changes of well under 1 KB each).
const MaxRequestBodyBytes = 1 << 20 // 1 MiB

// LimitBody rejects oversized bodies: decoding fails once the limit is hit,
// which every handler already answers with 400.
func LimitBody(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.ContentLength > MaxRequestBodyBytes {
			util.SendError(w, map[string]string{"error": "Request body too large"}, http.StatusRequestEntityTooLarge)
			return
		}
		if r.Body != nil {
			r.Body = http.MaxBytesReader(w, r.Body, MaxRequestBodyBytes)
		}
		next.ServeHTTP(w, r)
	})
}
