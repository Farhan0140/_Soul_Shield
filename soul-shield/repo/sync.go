package repo

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

// ---- Pull response shapes ----
//
// Every relationship is resolved to a uuid (CategoryUUID, ParentTaskUUID,
// TaskUUID, ...) instead of the server-internal bigint id — the mobile
// app's local-first store (soul-shield-mobile-app's Drizzle/SQLite schema)
// is keyed entirely by uuid, so it never needs to know those ids exist.
// DeletedAt is included (soft-deleted rows are NOT filtered out of a pull,
// unlike every other repo method in this package) - a pull is exactly how a
// client finds out a row was deleted, via its tombstone.

type SyncTask struct {
	UUID            string     `json:"uuid"`
	Title           string     `json:"title"`
	Description     *string    `json:"description,omitempty"`
	IsGlobal        bool       `json:"is_global"`
	RecurrenceType  string     `json:"recurrence_type"`
	RecurrenceDays  []int64    `json:"recurrence_days"`
	IsActive        bool       `json:"is_active"`
	CategoryUUID    *string    `json:"category_uuid,omitempty"`
	RewardText      *string    `json:"reward_text,omitempty"`
	TaskType        string     `json:"task_type"`
	TargetCount     *int32     `json:"target_count,omitempty"`
	DurationSeconds *int32     `json:"duration_seconds,omitempty"`
	ReminderTime    *string    `json:"reminder_time,omitempty"`
	SourceTaskUUID  *string    `json:"source_task_uuid,omitempty"`
	Position        int        `json:"position"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	DeletedAt       *time.Time `json:"deleted_at,omitempty"`
}

type SyncCategory struct {
	UUID      string     `json:"uuid"`
	Name      string     `json:"name"`
	ColorHex  string     `json:"color_hex"`
	Position  int        `json:"position"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	DeletedAt *time.Time `json:"deleted_at,omitempty"`
}

type SyncSubTask struct {
	UUID            string     `json:"uuid"`
	ParentTaskUUID  string     `json:"parent_task_uuid"`
	Title           string     `json:"title"`
	TaskType        string     `json:"task_type"`
	TargetCount     *int32     `json:"target_count,omitempty"`
	DurationSeconds *int32     `json:"duration_seconds,omitempty"`
	Position        int        `json:"position"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	DeletedAt       *time.Time `json:"deleted_at,omitempty"`
}

type SyncTaskCompletion struct {
	UUID          string     `json:"uuid"`
	TaskUUID      *string    `json:"task_uuid,omitempty"`
	TaskDate      string     `json:"task_date"`
	Status        string     `json:"status"`
	ProgressCount int32      `json:"progress_count"`
	CompletedAt   *time.Time `json:"completed_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	DeletedAt     *time.Time `json:"deleted_at,omitempty"`
}

type SyncSubTaskCompletion struct {
	UUID           string     `json:"uuid"`
	SubTaskUUID    *string    `json:"sub_task_uuid,omitempty"`
	ParentTaskUUID string     `json:"parent_task_uuid"`
	TaskDate       string     `json:"task_date"`
	Status         string     `json:"status"`
	ProgressCount  int32      `json:"progress_count"`
	CompletedAt    *time.Time `json:"completed_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	DeletedAt      *time.Time `json:"deleted_at,omitempty"`
}

type SyncSnapshot struct {
	// Cursor is the server's own clock at the moment the pull started
	// (captured via `SELECT now()`, not derived from the returned rows'
	// max updated_at) - passing it back as the next `since` means a row
	// updated concurrently with this exact request is simply picked up on
	// the *next* pull instead of possibly being missed, and (since nothing
	// here is paginated - this app's per-user row counts are small enough
	// to return in one response) there's no page-boundary tie to worry
	// about either.
	Cursor             time.Time              `json:"cursor"`
	Tasks              []SyncTask             `json:"tasks"`
	Categories         []SyncCategory         `json:"categories"`
	SubTasks           []SyncSubTask          `json:"sub_tasks"`
	TaskCompletions    []SyncTaskCompletion   `json:"task_completions"`
	SubTaskCompletions []SyncSubTaskCompletion `json:"sub_task_completions"`
}

// ---- Push request/response shapes ----

// SyncChange is one client-side edit being pushed. Data stays raw JSON here
// and is decoded into a resource-specific input struct per Resource/Op in
// sync_push.go, since its shape differs by both.
type SyncChange struct {
	Resource        string          `json:"resource"`
	Op              string          `json:"op"`
	UUID            string          `json:"uuid"`
	ClientUpdatedAt time.Time       `json:"client_updated_at"`
	Data            json.RawMessage `json:"data"`
}

type SyncChangeResult struct {
	Resource string `json:"resource"`
	UUID     string `json:"uuid"`
	// Status: "accepted" (applied as sent), "superseded" (a newer
	// server-side updated_at won - ServerRow carries the authoritative
	// version so the caller can reconcile/log it), or "rejected" (validation
	// or ownership failure for this one change specifically - Error
	// explains why; unlike a Go error return from PushChanges, this does
	// NOT abort the rest of the batch).
	Status    string `json:"status"`
	ServerRow any    `json:"server_row,omitempty"`
	Error     string `json:"error,omitempty"`
}

type SyncRepo interface {
	PullChanges(userID int64, since time.Time) (*SyncSnapshot, error)
	PushChanges(userID int64, changes []SyncChange) ([]SyncChangeResult, error)
}

type syncRepo struct {
	db *sqlx.DB
}

func NewSyncRepo(db *sqlx.DB) SyncRepo {
	return &syncRepo{db: db}
}

// ---- Pull ----

func (r *syncRepo) PullChanges(userID int64, since time.Time) (*SyncSnapshot, error) {
	var cursor time.Time
	if err := r.db.Get(&cursor, `SELECT now()`); err != nil {
		return nil, err
	}

	tasks, err := r.pullTasks(userID, since)
	if err != nil {
		return nil, err
	}
	categories, err := r.pullCategories(userID, since)
	if err != nil {
		return nil, err
	}
	subTasks, err := r.pullSubTasks(userID, since)
	if err != nil {
		return nil, err
	}
	taskCompletions, err := r.pullTaskCompletions(userID, since)
	if err != nil {
		return nil, err
	}
	subTaskCompletions, err := r.pullSubTaskCompletions(userID, since)
	if err != nil {
		return nil, err
	}

	return &SyncSnapshot{
		Cursor:             cursor,
		Tasks:              tasks,
		Categories:         categories,
		SubTasks:           subTasks,
		TaskCompletions:    taskCompletions,
		SubTaskCompletions: subTaskCompletions,
	}, nil
}

func (r *syncRepo) pullTasks(userID int64, since time.Time) ([]SyncTask, error) {
	rows, err := r.db.Query(`
		SELECT
			t.uuid, t.title, t.description, t.is_global, t.recurrence_type, t.recurrence_days,
			t.is_active, c.uuid, t.reward_text, t.task_type, t.target_count, t.duration_seconds,
			t.reminder_time, src.uuid, t.position, t.created_at, t.updated_at, t.deleted_at
		FROM tasks t
		LEFT JOIN categories c ON c.id = t.category_id
		LEFT JOIN tasks src ON src.id = t.source_task_id
		WHERE (t.is_global = true OR t.owner_id = $1) AND t.updated_at > $2
		ORDER BY t.updated_at, t.id
	`, userID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []SyncTask
	for rows.Next() {
		var item SyncTask
		var description, rewardText, reminderTime sql.NullString
		var categoryUUID, sourceUUID sql.NullString
		var targetCount, durationSeconds sql.NullInt32
		var deletedAt sql.NullTime
		var recurrenceDays pq.Int64Array

		if err := rows.Scan(
			&item.UUID, &item.Title, &description, &item.IsGlobal, &item.RecurrenceType, &recurrenceDays,
			&item.IsActive, &categoryUUID, &rewardText, &item.TaskType, &targetCount, &durationSeconds,
			&reminderTime, &sourceUUID, &item.Position, &item.CreatedAt, &item.UpdatedAt, &deletedAt,
		); err != nil {
			return nil, err
		}

		item.RecurrenceDays = []int64(recurrenceDays)
		item.Description = nullStringPtr(description)
		item.RewardText = nullStringPtr(rewardText)
		item.ReminderTime = nullStringPtr(reminderTime)
		item.CategoryUUID = nullStringPtr(categoryUUID)
		item.SourceTaskUUID = nullStringPtr(sourceUUID)
		item.TargetCount = nullInt32Ptr(targetCount)
		item.DurationSeconds = nullInt32Ptr(durationSeconds)
		item.DeletedAt = nullTimePtr(deletedAt)

		results = append(results, item)
	}
	return results, rows.Err()
}

func (r *syncRepo) pullCategories(userID int64, since time.Time) ([]SyncCategory, error) {
	rows, err := r.db.Query(`
		SELECT uuid, name, color_hex, position, created_at, updated_at, deleted_at
		FROM categories
		WHERE owner_id = $1 AND updated_at > $2
		ORDER BY updated_at, id
	`, userID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []SyncCategory
	for rows.Next() {
		var item SyncCategory
		var deletedAt sql.NullTime
		if err := rows.Scan(&item.UUID, &item.Name, &item.ColorHex, &item.Position, &item.CreatedAt, &item.UpdatedAt, &deletedAt); err != nil {
			return nil, err
		}
		item.DeletedAt = nullTimePtr(deletedAt)
		results = append(results, item)
	}
	return results, rows.Err()
}

func (r *syncRepo) pullSubTasks(userID int64, since time.Time) ([]SyncSubTask, error) {
	rows, err := r.db.Query(`
		SELECT
			st.uuid, t.uuid, st.title, st.task_type, st.target_count, st.duration_seconds,
			st.position, st.created_at, st.updated_at, st.deleted_at
		FROM sub_tasks st
		JOIN tasks t ON t.id = st.parent_task_id
		WHERE (t.is_global = true OR t.owner_id = $1) AND st.updated_at > $2
		ORDER BY st.updated_at, st.id
	`, userID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []SyncSubTask
	for rows.Next() {
		var item SyncSubTask
		var targetCount, durationSeconds sql.NullInt32
		var deletedAt sql.NullTime
		if err := rows.Scan(
			&item.UUID, &item.ParentTaskUUID, &item.Title, &item.TaskType, &targetCount, &durationSeconds,
			&item.Position, &item.CreatedAt, &item.UpdatedAt, &deletedAt,
		); err != nil {
			return nil, err
		}
		item.TargetCount = nullInt32Ptr(targetCount)
		item.DurationSeconds = nullInt32Ptr(durationSeconds)
		item.DeletedAt = nullTimePtr(deletedAt)
		results = append(results, item)
	}
	return results, rows.Err()
}

func (r *syncRepo) pullTaskCompletions(userID int64, since time.Time) ([]SyncTaskCompletion, error) {
	rows, err := r.db.Query(`
		SELECT tc.uuid, t.uuid, tc.task_date, tc.status, tc.progress_count, tc.completed_at,
			tc.created_at, tc.updated_at, tc.deleted_at
		FROM task_completions tc
		LEFT JOIN tasks t ON t.id = tc.task_id
		WHERE tc.user_id = $1 AND tc.updated_at > $2
		ORDER BY tc.updated_at, tc.id
	`, userID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []SyncTaskCompletion
	for rows.Next() {
		var item SyncTaskCompletion
		var taskUUID sql.NullString
		var taskDate time.Time
		var completedAt, deletedAt sql.NullTime
		if err := rows.Scan(
			&item.UUID, &taskUUID, &taskDate, &item.Status, &item.ProgressCount, &completedAt,
			&item.CreatedAt, &item.UpdatedAt, &deletedAt,
		); err != nil {
			return nil, err
		}
		item.TaskUUID = nullStringPtr(taskUUID)
		item.TaskDate = taskDate.Format("2006-01-02")
		item.CompletedAt = nullTimePtr(completedAt)
		item.DeletedAt = nullTimePtr(deletedAt)
		results = append(results, item)
	}
	return results, rows.Err()
}

func (r *syncRepo) pullSubTaskCompletions(userID int64, since time.Time) ([]SyncSubTaskCompletion, error) {
	rows, err := r.db.Query(`
		SELECT stc.uuid, st.uuid, pt.uuid, stc.task_date, stc.status, stc.progress_count,
			stc.completed_at, stc.created_at, stc.updated_at, stc.deleted_at
		FROM sub_task_completions stc
		LEFT JOIN sub_tasks st ON st.id = stc.sub_task_id
		JOIN tasks pt ON pt.id = stc.parent_task_id
		WHERE stc.user_id = $1 AND stc.updated_at > $2
		ORDER BY stc.updated_at, stc.id
	`, userID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []SyncSubTaskCompletion
	for rows.Next() {
		var item SyncSubTaskCompletion
		var subTaskUUID sql.NullString
		var taskDate time.Time
		var completedAt, deletedAt sql.NullTime
		if err := rows.Scan(
			&item.UUID, &subTaskUUID, &item.ParentTaskUUID, &taskDate, &item.Status, &item.ProgressCount,
			&completedAt, &item.CreatedAt, &item.UpdatedAt, &deletedAt,
		); err != nil {
			return nil, err
		}
		item.SubTaskUUID = nullStringPtr(subTaskUUID)
		item.TaskDate = taskDate.Format("2006-01-02")
		item.CompletedAt = nullTimePtr(completedAt)
		item.DeletedAt = nullTimePtr(deletedAt)
		results = append(results, item)
	}
	return results, rows.Err()
}

// ---- small scan helpers ----

func nullStringPtr(v sql.NullString) *string {
	if !v.Valid {
		return nil
	}
	s := v.String
	return &s
}

func nullInt32Ptr(v sql.NullInt32) *int32 {
	if !v.Valid {
		return nil
	}
	n := v.Int32
	return &n
}

func nullTimePtr(v sql.NullTime) *time.Time {
	if !v.Valid {
		return nil
	}
	t := v.Time
	return &t
}
