package repo

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"
)

// NewFeedback is one rating/feedback submission. Exactly one of UserID and
// GuestDeviceID is set.
type NewFeedback struct {
	UserID        *int64
	GuestDeviceID *int64
	Rating        int
	Message       *string
	Platform      *string
}

// FeedbackItem is a submission as the admin panel lists it.
type FeedbackItem struct {
	ID        int64     `json:"id"`
	Rating    int       `json:"rating"`
	Message   *string   `json:"message,omitempty"`
	Platform  *string   `json:"platform,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	Read      bool      `json:"read"`
	// Submitter: the account's name, or "guest-user-<n>" for a phone used
	// without an account.
	Submitter string  `json:"submitter"`
	Email     *string `json:"email,omitempty"`
	IsGuest   bool    `json:"is_guest"`
}

// RatingSummary counts each person once, with their latest rating.
type RatingSummary struct {
	// Counts["1"]..Counts["5"]: how many people currently rate the app that.
	Counts  map[string]int `json:"counts"`
	Total   int            `json:"total"`
	Average float64        `json:"average"`
}

type FeedbackRepo interface {
	// GuestDeviceID returns the guest number for a device id, creating it on
	// first use.
	GuestDeviceID(deviceID string) (int64, error)
	Create(f NewFeedback) (int64, error)
	// List returns submissions newest first; beforeID > 0 pages backwards.
	List(limit int, beforeID int64) ([]FeedbackItem, error)
	Summary() (*RatingSummary, error)
	UnreadCount() (int, error)
	MarkAllRead() error
}

type feedbackRepo struct {
	db *sqlx.DB
}

func NewFeedbackRepo(db *sqlx.DB) FeedbackRepo {
	return &feedbackRepo{db: db}
}

// GuestName is how a guest device appears to admins.
func GuestName(guestDeviceID int64) string {
	return fmt.Sprintf("guest-user-%d", guestDeviceID)
}

func (r *feedbackRepo) GuestDeviceID(deviceID string) (int64, error) {
	var id int64
	err := r.db.Get(&id, `SELECT id FROM guest_devices WHERE device_id = $1`, deviceID)
	if err == nil {
		return id, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return 0, err
	}
	// Insert only when missing (an upsert would burn a sequence number on
	// every repeat and leave gaps in the guest numbering). ON CONFLICT covers
	// two first submissions racing; the loser re-reads the winner's row.
	err = r.db.Get(&id, `
		INSERT INTO guest_devices (device_id) VALUES ($1)
		ON CONFLICT (device_id) DO NOTHING
		RETURNING id
	`, deviceID)
	if errors.Is(err, sql.ErrNoRows) {
		err = r.db.Get(&id, `SELECT id FROM guest_devices WHERE device_id = $1`, deviceID)
	}
	return id, err
}

func (r *feedbackRepo) Create(f NewFeedback) (int64, error) {
	var id int64
	err := r.db.Get(&id, `
		INSERT INTO feedback (user_id, guest_device_id, rating, message, platform)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, f.UserID, f.GuestDeviceID, f.Rating, f.Message, f.Platform)
	return id, err
}

func (r *feedbackRepo) List(limit int, beforeID int64) ([]FeedbackItem, error) {
	rows, err := r.db.Query(`
		SELECT f.id, f.rating, f.message, f.platform, f.created_at, f.read_at IS NOT NULL,
			u.full_name, u.email, f.guest_device_id
		FROM feedback f
		LEFT JOIN users u ON u.id = f.user_id
		WHERE ($2 = 0 OR f.id < $2)
		ORDER BY f.id DESC
		LIMIT $1
	`, limit, beforeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []FeedbackItem{}
	for rows.Next() {
		var item FeedbackItem
		var message, platform, name, email sql.NullString
		var guestID sql.NullInt64
		if err := rows.Scan(&item.ID, &item.Rating, &message, &platform, &item.CreatedAt, &item.Read,
			&name, &email, &guestID); err != nil {
			return nil, err
		}
		item.Message = nullStringPtr(message)
		item.Platform = nullStringPtr(platform)
		if guestID.Valid {
			item.IsGuest = true
			item.Submitter = GuestName(guestID.Int64)
		} else {
			item.Submitter = name.String
			item.Email = nullStringPtr(email)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *feedbackRepo) Summary() (*RatingSummary, error) {
	// One vote per person: each account / guest device counts with its most
	// recent rating only. DISTINCT ON treats NULLs as equal, and exactly one
	// of the two ids is set per row, so this is one row per submitter.
	rows, err := r.db.Query(`
		SELECT rating, count(*) FROM (
			SELECT DISTINCT ON (user_id, guest_device_id) rating
			FROM feedback
			ORDER BY user_id, guest_device_id, created_at DESC, id DESC
		) latest
		GROUP BY rating
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	summary := &RatingSummary{Counts: map[string]int{"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}}
	sum := 0
	for rows.Next() {
		var rating, count int
		if err := rows.Scan(&rating, &count); err != nil {
			return nil, err
		}
		summary.Counts[fmt.Sprint(rating)] = count
		summary.Total += count
		sum += rating * count
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if summary.Total > 0 {
		summary.Average = float64(sum) / float64(summary.Total)
	}
	return summary, nil
}

func (r *feedbackRepo) UnreadCount() (int, error) {
	var n int
	err := r.db.Get(&n, `SELECT count(*) FROM feedback WHERE read_at IS NULL`)
	return n, err
}

func (r *feedbackRepo) MarkAllRead() error {
	_, err := r.db.Exec(`UPDATE feedback SET read_at = now() WHERE read_at IS NULL`)
	return err
}
