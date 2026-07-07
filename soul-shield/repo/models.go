package repo

import (
	"database/sql"
	"time"

	"github.com/lib/pq"
)

type Task struct {
	ID             int64          `db:"id" json:"id"`
	Title          string         `db:"title" json:"title"`
	Description    sql.NullString `db:"description" json:"description"`
	IsGlobal       bool           `db:"is_global" json:"is_global"`
	OwnerID        sql.NullInt64  `db:"owner_id" json:"owner_id,omitempty"`
	RecurrenceType string         `db:"recurrence_type" json:"recurrence_type"`
	RecurrenceDays pq.Int64Array  `db:"recurrence_days" json:"recurrence_days"`
	IsActive       bool           `db:"is_active" json:"is_active"`
	CreatedBy      int64          `db:"created_by" json:"created_by"`
	CreatedAt      time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time      `db:"updated_at" json:"updated_at"`
}

// TaskUpdate - সব ফিল্ড pointer, যাতে partial update করা যায় (nil মানে ঐ ফিল্ড change হবে না)
type TaskUpdate struct {
	Title          *string
	Description    *string
	RecurrenceType *string
	RecurrenceDays *[]int64
	IsActive       *bool
}

type TaskCompletion struct {
	ID                int64         `db:"id" json:"id"`
	TaskID            sql.NullInt64 `db:"task_id" json:"task_id,omitempty"`
	UserID            int64         `db:"user_id" json:"user_id"`
	TaskTitleSnapshot string        `db:"task_title_snapshot" json:"task_title"`
	TaskDate          time.Time     `db:"task_date" json:"task_date"`
	Status            string        `db:"status" json:"status"`
	CompletedAt       sql.NullTime  `db:"completed_at" json:"completed_at,omitempty"`
	CreatedAt         time.Time     `db:"created_at" json:"created_at"`
}

// TaskWithStatus - handler কে যা রিটার্ন করা হবে (task + একটা নির্দিষ্ট দিনের status একসাথে)
type TaskWithStatus struct {
	TaskID         int64      `json:"task_id"`
	Title          string     `json:"title"`
	Description    string     `json:"description"`
	IsGlobal       bool       `json:"is_global"`
	RecurrenceType string     `json:"recurrence_type"`
	Date           string     `json:"date"`
	Status         string     `json:"status"`
	CompletedAt    *time.Time `json:"completed_at,omitempty"`
}

// User Model
type User struct {
	ID        int64  `json:"id" db:"id"`
	Full_Name string `json:"full_name" db:"full_name"`
	Email     string `json:"email" db:"email"`
	Password  string `json:"password" db:"password"`
	Role      string `json:"role" db:"role"`
}
