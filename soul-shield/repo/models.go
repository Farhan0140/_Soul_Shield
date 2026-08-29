package repo

import (
	"database/sql"
	"time"

	"github.com/lib/pq"
)

// type Task struct {
// 	ID             int64          `db:"id" json:"id"`
// 	Title          string         `db:"title" json:"title"`
// 	Description    sql.NullString `db:"description" json:"description"`
// 	IsGlobal       bool           `db:"is_global" json:"is_global"`
// 	OwnerID        sql.NullInt64  `db:"owner_id" json:"owner_id,omitempty"`
// 	RecurrenceType string         `db:"recurrence_type" json:"recurrence_type"`
// 	RecurrenceDays pq.Int64Array  `db:"recurrence_days" json:"recurrence_days"`
// 	IsActive       bool           `db:"is_active" json:"is_active"`
// 	CreatedBy      int64          `db:"created_by" json:"created_by"`
// 	CreatedAt      time.Time      `db:"created_at" json:"created_at"`
// 	UpdatedAt      time.Time      `db:"updated_at" json:"updated_at"`
// }

type Task struct {
	ID              int64          `db:"id" json:"id"`
	Title           string         `db:"title" json:"title"`
	Description     sql.NullString `db:"description" json:"description"`
	IsGlobal        bool           `db:"is_global" json:"is_global"`
	OwnerID         sql.NullInt64  `db:"owner_id" json:"owner_id,omitempty"`
	RecurrenceType  string         `db:"recurrence_type" json:"recurrence_type"`
	RecurrenceDays  pq.Int64Array  `db:"recurrence_days" json:"recurrence_days"`
	IsActive        bool           `db:"is_active" json:"is_active"`
	CreatedBy       int64          `db:"created_by" json:"created_by"`
	CategoryID      sql.NullInt64  `db:"category_id" json:"category_id,omitempty"`
	RewardText      sql.NullString `db:"reward_text" json:"reward_text,omitempty"`
	TaskType        string         `db:"task_type" json:"task_type"`
	TargetCount     sql.NullInt32  `db:"target_count" json:"target_count,omitempty"`
	DurationSeconds sql.NullInt32  `db:"duration_seconds" json:"duration_seconds,omitempty"`
	ReminderTime    sql.NullString `db:"reminder_time" json:"reminder_time,omitempty"`
	SourceTaskID    sql.NullInt64  `db:"source_task_id" json:"source_task_id,omitempty"`
	Position        int            `db:"position" json:"position"`
	CreatedAt       time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time      `db:"updated_at" json:"updated_at"`
}

// TaskRef - একটা personal task এর ন্যূনতম তথ্য (id/title/source_task_id), যা দিয়ে
// bulk এ "already added" চেক করা যায় (ListOwnedRefs এ ব্যবহার হয়)
type TaskRef struct {
	ID           int64         `db:"id"`
	Title        string        `db:"title"`
	SourceTaskID sql.NullInt64 `db:"source_task_id"`
}

// TaskUpdate - সব ফিল্ড pointer, যাতে partial update করা যায় (nil মানে ঐ ফিল্ড change হবে না)
// type TaskUpdate struct {
// 	Title          *string
// 	Description    *string
// 	RecurrenceType *string
// 	RecurrenceDays *[]int64
// 	IsActive       *bool
// }

type TaskUpdate struct {
	Title           *string
	Description     *string
	RecurrenceType  *string
	RecurrenceDays  *[]int64
	IsActive        *bool
	CategoryID      *int64 // 0 দিলে uncategorize করা হবে বলে ধরবো (handler এ চেক করবো)
	RewardText      *string
	TargetCount     *int32
	DurationSeconds *int32
	ReminderTime    *string
}

// type TaskCompletion struct {
// 	ID                int64         `db:"id" json:"id"`
// 	TaskID            sql.NullInt64 `db:"task_id" json:"task_id,omitempty"`
// 	UserID            int64         `db:"user_id" json:"user_id"`
// 	TaskTitleSnapshot string        `db:"task_title_snapshot" json:"task_title"`
// 	TaskDate          time.Time     `db:"task_date" json:"task_date"`
// 	Status            string        `db:"status" json:"status"`
// 	CompletedAt       sql.NullTime  `db:"completed_at" json:"completed_at,omitempty"`
// 	CreatedAt         time.Time     `db:"created_at" json:"created_at"`
// }

type TaskCompletion struct {
	ID                int64         `db:"id" json:"id"`
	TaskID            sql.NullInt64 `db:"task_id" json:"task_id,omitempty"`
	UserID            int64         `db:"user_id" json:"user_id"`
	TaskTitleSnapshot string        `db:"task_title_snapshot" json:"task_title"`
	TaskDate          time.Time     `db:"task_date" json:"task_date"`
	Status            string        `db:"status" json:"status"`
	ProgressCount     int32         `db:"progress_count" json:"progress_count"`
	CompletedAt       sql.NullTime  `db:"completed_at" json:"completed_at,omitempty"`
	CreatedAt         time.Time     `db:"created_at" json:"created_at"`

	// RewardText শুধু status completed হলেই সেট করা হয় (Complete/Increment এ, tasks.reward_text থেকে)
	RewardText *string `db:"-" json:"reward_text,omitempty"`
}

// TaskWithStatus - handler কে যা রিটার্ন করা হবে (task + একটা নির্দিষ্ট দিনের status একসাথে)
// type TaskWithStatus struct {
// 	TaskID         int64      `json:"task_id"`
// 	Title          string     `json:"title"`
// 	Description    string     `json:"description"`
// 	IsGlobal       bool       `json:"is_global"`
// 	RecurrenceType string     `json:"recurrence_type"`
// 	Date           string     `json:"date"`
// 	Status         string     `json:"status"`
// 	CompletedAt    *time.Time `json:"completed_at,omitempty"`
// }

type TaskWithStatus struct {
	TaskID         int64      `json:"task_id"`
	Title          string     `json:"title"`
	Description    string     `json:"description"`
	IsGlobal       bool       `json:"is_global"`
	RecurrenceType string     `json:"recurrence_type"`
	Date           string     `json:"date"`
	Status         string     `json:"status"`
	CompletedAt    *time.Time `json:"completed_at,omitempty"`

	CategoryID    *int64  `json:"category_id,omitempty"`
	CategoryName  *string `json:"category_name,omitempty"`
	CategoryColor *string `json:"category_color,omitempty"`

	RewardText *string `json:"reward_text,omitempty"` // completed হলেই শুধু response এ দেখাবো (handler এ)

	TaskType        string `json:"task_type"`
	TargetCount     *int32 `json:"target_count,omitempty"`
	DurationSeconds *int32 `json:"duration_seconds,omitempty"`
	ProgressCount   int32  `json:"progress_count"`

	RecurrenceDays []int64 `json:"recurrence_days,omitempty"`
	ReminderTime   *string `json:"reminder_time,omitempty"`

	Position int `json:"position"`

	SubTasks []SubTaskWithStatus `json:"sub_tasks,omitempty"`
}

// ---- Sub-Tasks ----

type SubTask struct {
	ID              int64         `db:"id" json:"id"`
	ParentTaskID    int64         `db:"parent_task_id" json:"parent_task_id"`
	Title           string        `db:"title" json:"title"`
	TaskType        string        `db:"task_type" json:"task_type"`
	TargetCount     sql.NullInt32 `db:"target_count" json:"target_count,omitempty"`
	DurationSeconds sql.NullInt32 `db:"duration_seconds" json:"duration_seconds,omitempty"`
	Position        int           `db:"position" json:"position"`
	CreatedAt       time.Time     `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time     `db:"updated_at" json:"updated_at"`
}

type SubTaskCompletion struct {
	ID                   int64         `db:"id" json:"id"`
	SubTaskID            sql.NullInt64 `db:"sub_task_id" json:"sub_task_id,omitempty"`
	ParentTaskID         int64         `db:"parent_task_id" json:"parent_task_id"`
	UserID               int64         `db:"user_id" json:"user_id"`
	SubTaskTitleSnapshot string        `db:"sub_task_title_snapshot" json:"sub_task_title"`
	TaskDate             time.Time     `db:"task_date" json:"task_date"`
	Status               string        `db:"status" json:"status"`
	ProgressCount        int32         `db:"progress_count" json:"progress_count"`
	CompletedAt          sql.NullTime  `db:"completed_at" json:"completed_at,omitempty"`
	CreatedAt            time.Time     `db:"created_at" json:"created_at"`
}

// SubTaskWithStatus - একটা নির্দিষ্ট দিনের জন্য sub-task + তার status (list/history endpoint এ ব্যবহার হয়)
type SubTaskWithStatus struct {
	SubTaskID       int64      `json:"sub_task_id"`
	ParentTaskID    int64      `json:"parent_task_id"`
	Title           string     `json:"title"`
	TaskType        string     `json:"task_type"`
	TargetCount     *int32     `json:"target_count,omitempty"`
	DurationSeconds *int32     `json:"duration_seconds,omitempty"`
	ProgressCount   int32      `json:"progress_count"`
	Position        int        `json:"position"`
	Status          string     `json:"status"`
	CompletedAt     *time.Time `json:"completed_at,omitempty"`
}

// User Model
type User struct {
	ID        int64  `json:"id" db:"id"`
	Full_Name string `json:"full_name" db:"full_name"`
	Email     string `json:"email" db:"email"`
	Password  string `json:"password" db:"password"`
	Role      string `json:"role" db:"role"`

	// SecurityAnswer is the plaintext answer supplied on registration. It is never persisted
	// as-is (db:"-") — Create() hashes it into SecurityAnswerHash before the INSERT.
	SecurityAnswer            string         `json:"-" db:"-"`
	SecurityAnswerHash        sql.NullString `json:"-" db:"security_answer_hash"`
	SecurityAnswerAttempts    int            `json:"-" db:"security_answer_attempts"`
	SecurityAnswerLockedUntil sql.NullTime   `json:"-" db:"security_answer_locked_until"`
}
