package repo

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

// ---- Expo push tokens + the "data changed" fan-out ----
//
// Cross-device sync alerts (see migrations/000003): a device registers its
// Expo push token here, and when that user's tasks change through the REST
// path (web edits — the mobile path already syncs itself), NotifyDataChange
// sends a SILENT push to every registered token so those devices run a
// catch-up sync right away instead of waiting for their next app-open /
// reconnect / once-nightly window.
//
// B5 (2026-11-18): the push is data-only (no title/body), so the phone never
// shows a banner or plays a sound for it - the app's background notification
// task (soul-shield-mobile-app/lib/background-sync/data-change-task.ts) runs
// the sync instead. And it is debounced per user (dataChangeDebounce): a burst
// of web edits (every counter flush, every checkbox) becomes at most one push
// per window, with a trailing push so the last change is never missed.
// Best-effort only: a failed Expo call is logged, never surfaced to the
// mutating user.

// dataChangeDebounce is the minimum gap between two pushes to one user.
const dataChangeDebounce = 30 * time.Second

type PushRepo interface {
	UpsertToken(userID int64, token string, platform string) error
	DeleteToken(userID int64, token string) error
	ListTokens(userID int64) ([]string, error)
	// NotifyDataChange fans a push out to the user's tokens asynchronously;
	// never blocks the caller's response.
	NotifyDataChange(userID int64)
}

type pushRepo struct {
	db *sqlx.DB

	mu sync.Mutex
	// debounce state per user id
	lastSent map[int64]time.Time
	pending  map[int64]bool
}

func NewPushRepo(db *sqlx.DB) PushRepo {
	return &pushRepo{db: db, lastSent: map[int64]time.Time{}, pending: map[int64]bool{}}
}

// UpsertToken registers token for userID. A token already registered to
// another user is moved to this one (S10c, reviewed 2026-11-18, kept on
// purpose): an Expo push token identifies one app install, and only that
// install can read it, so a re-registration means a different account
// signed in on that device (e.g. after a logout that couldn't reach the
// server to delete the token). Refusing would leave the new account
// without sync alerts. The push carries no data, only "sync now".
func (r *pushRepo) UpsertToken(userID int64, token string, platform string) error {
	_, err := r.db.Exec(`
		INSERT INTO user_push_tokens (user_id, token, platform)
		VALUES ($1, $2, $3)
		ON CONFLICT (token) DO UPDATE SET user_id = $1, platform = $3
	`, userID, token, platform)
	return err
}

func (r *pushRepo) DeleteToken(userID int64, token string) error {
	_, err := r.db.Exec(`DELETE FROM user_push_tokens WHERE user_id = $1 AND token = $2`, userID, token)
	return err
}

func (r *pushRepo) ListTokens(userID int64) ([]string, error) {
	var tokens []string
	err := r.db.Select(&tokens, `SELECT token FROM user_push_tokens WHERE user_id = $1`, userID)
	return tokens, err
}

// expoPushMessage is a data-only ("headless background") Expo push: no
// title/body, so it is never displayed; contentAvailable wakes the iOS app
// and high priority lets Android deliver it promptly.
type expoPushMessage struct {
	To               string         `json:"to"`
	Data             map[string]any `json:"data"`
	Priority         string         `json:"priority"`
	ContentAvailable bool           `json:"contentAvailable"`
	// Legacy spelling of contentAvailable, still read by the Expo service.
	LegacyContentAvailable bool `json:"_contentAvailable"`
	// A stale "go sync" is pointless; don't deliver it hours later.
	TTL int `json:"ttl"`
}

// NotifyDataChange schedules the silent push. The first change after a quiet
// period is sent immediately; changes within dataChangeDebounce of the last
// push collapse into ONE trailing push at the end of the window. Never blocks
// the caller.
func (r *pushRepo) NotifyDataChange(userID int64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.pruneLocked()

	if r.pending[userID] {
		return // a trailing push is already scheduled and will cover this change
	}
	wait := dataChangeDebounce - time.Since(r.lastSent[userID])
	if wait <= 0 {
		r.lastSent[userID] = time.Now()
		go r.sendDataChange(userID)
		return
	}
	r.pending[userID] = true
	time.AfterFunc(wait, func() {
		r.mu.Lock()
		delete(r.pending, userID)
		r.lastSent[userID] = time.Now()
		r.mu.Unlock()
		r.sendDataChange(userID)
	})
}

// pruneLocked drops debounce entries that can no longer matter, so the map
// doesn't grow with every user who ever edited something.
func (r *pushRepo) pruneLocked() {
	if len(r.lastSent) < 1024 {
		return
	}
	for id, at := range r.lastSent {
		if time.Since(at) > dataChangeDebounce && !r.pending[id] {
			delete(r.lastSent, id)
		}
	}
}

// sendDataChange posts one batched request to Expo for all of the user's
// devices. Panics are contained (this runs outside any request's recovery).
func (r *pushRepo) sendDataChange(userID int64) {
	defer func() {
		if rec := recover(); rec != nil {
			slog.Error("push notify: recovered from panic", "panic", rec)
		}
	}()

	tokens, err := r.ListTokens(userID)
	if err != nil {
		slog.Warn("push notify: listing tokens failed", "user_id", userID, "error", err)
		return
	}

	// Expo takes at most 100 messages per request.
	var dead []string
	for start := 0; start < len(tokens); start += 100 {
		batch := tokens[start:min(start+100, len(tokens))]
		dead = append(dead, sendExpoBatch(userID, batch)...)
	}

	// B17: an uninstalled app's token answers DeviceNotRegistered forever;
	// drop it instead of retrying it on every change.
	if len(dead) > 0 {
		if _, err := r.db.Exec(`DELETE FROM user_push_tokens WHERE token = ANY($1)`, pq.StringArray(dead)); err != nil {
			slog.Warn("push notify: removing dead tokens failed", "user_id", userID, "error", err)
		} else {
			slog.Info("push notify: removed unregistered devices", "user_id", userID, "count", len(dead))
		}
	}
}

// sendExpoBatch sends one data-change push per token (<= 100) and returns the
// tokens Expo reported as DeviceNotRegistered.
func sendExpoBatch(userID int64, tokens []string) []string {
	messages := make([]expoPushMessage, len(tokens))
	for i, token := range tokens {
		messages[i] = expoPushMessage{
			To:                     token,
			Data:                   map[string]any{"type": "data-change"},
			Priority:               "high",
			ContentAvailable:       true,
			LegacyContentAvailable: true,
			TTL:                    3600,
		}
	}
	payload, err := json.Marshal(messages)
	if err != nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://exp.host/--/api/v2/push/send", bytes.NewReader(payload))
	if err != nil {
		return nil
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		slog.Warn("push notify: send failed", "user_id", userID, "error", err)
		return nil
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		slog.Warn("push notify: Expo rejected the request", "user_id", userID, "status", resp.StatusCode, "body_head", headOf(body))
		return nil
	}
	return unregisteredTokens(tokens, body)
}

// unregisteredTokens reads Expo's push tickets (one per message, in order)
// and returns the tokens whose ticket says DeviceNotRegistered.
func unregisteredTokens(tokens []string, body []byte) []string {
	var parsed struct {
		Data []struct {
			Status  string `json:"status"`
			Details struct {
				Error string `json:"error"`
			} `json:"details"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil
	}
	var dead []string
	for i, ticket := range parsed.Data {
		if i < len(tokens) && ticket.Status == "error" && ticket.Details.Error == "DeviceNotRegistered" {
			dead = append(dead, tokens[i])
		}
	}
	return dead
}

func headOf(b []byte) string {
	if len(b) > 80 {
		return string(b[:80])
	}
	return string(b)
}
