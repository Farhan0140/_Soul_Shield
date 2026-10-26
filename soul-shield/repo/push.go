package repo

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/jmoiron/sqlx"
)

// ---- Expo push tokens + the "data changed" fan-out ----
//
// Cross-device sync alerts (see migrations/000003): a device registers its
// Expo push token here, and when that user's tasks change through the REST
// path (web edits — the mobile path already syncs itself), NotifyDataChange
// pushes a short heads-up to every registered token so those devices run a
// catch-up sync right away instead of waiting for their next app-open /
// reconnect / once-nightly window.
//
// v1 is deliberately noisy-tolerant: the push goes to ALL of the user's
// tokens, including the device that triggered the change if it's a web edit
// (harmless — the mobile client just runs its idempotent sync) and there is
// no batching/dedup window. Best-effort only: a failed Expo call is logged,
// never surfaced to the mutating user.

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
}

func NewPushRepo(db *sqlx.DB) PushRepo {
	return &pushRepo{db: db}
}

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

type expoPushMessage struct {
	To    string                 `json:"to"`
	Title string                 `json:"title"`
	Body  string                 `json:"body"`
	Data  map[string]interface{} `json:"data"`
}

// NotifyDataChange fires the fan-out on its own goroutine so a slow/unreachable
// Expo API never delays the mutation that caused the change. Panics inside the
// goroutine are contained (this runs outside the request handler's recovery).
func (r *pushRepo) NotifyDataChange(userID int64) {
	go func() {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("push notify: recovered from panic: %v", rec)
			}
		}()

		tokens, err := r.ListTokens(userID)
		if err != nil || len(tokens) == 0 {
			return
		}

		client := &http.Client{Timeout: 10 * time.Second}
		for _, token := range tokens {
			msg := expoPushMessage{
				To:    token,
				Title: "Soul Shield",
				Body:  "Your tasks were updated on another device — tap to sync.",
				Data:  map[string]interface{}{"type": "data-change"},
			}
			payload, err := json.Marshal(msg)
			if err != nil {
				continue
			}
			req, err := http.NewRequestWithContext(
				context.Background(),
				http.MethodPost,
				"https://exp.host/--/api/v2/push/send",
				bytes.NewReader(payload),
			)
			if err != nil {
				continue
			}
			req.Header.Set("Content-Type", "application/json")
			resp, err := client.Do(req)
			if err != nil {
				log.Printf("push notify: send to a device failed: %v", err)
				continue
			}
			_ = resp.Body.Close()
			if resp.StatusCode < 200 || resp.StatusCode > 299 {
				log.Printf("push notify: send to a device returned %d (unused payload head: %s)", resp.StatusCode, headOf(payload))
			}
		}
	}()
}

func headOf(b []byte) string {
	if len(b) > 80 {
		return string(b[:80])
	}
	return string(b)
}
