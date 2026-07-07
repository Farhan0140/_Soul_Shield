package repo

import (
	"database/sql"
	"errors"
	"soulsheld/util"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

// ---- Interface ----

type TaskRepo interface {
	Create(task Task) (*Task, error)
	Update(id int64, updates TaskUpdate, requestingUserID int64, role string) (*Task, error)
	Delete(id int64, requestingUserID int64, role string) error
	GetByID(id int64) (*Task, error)
	ListForDate(userID int64, date time.Time) ([]TaskWithStatus, error)
	ListForRange(userID int64, from, to time.Time) ([]TaskWithStatus, error)
	Complete(taskID int64, userID int64, date time.Time) (*TaskCompletion, error)
}

type taskRepo struct {
	db *sqlx.DB
}

func NewTaskRepo(db *sqlx.DB) TaskRepo {
	return &taskRepo{db: db}
}

// ---- Create ----
func (r *taskRepo) Create(task Task) (*Task, error) {
	if task.RecurrenceType == util.RecurrenceDaily {
		task.RecurrenceDays = pq.Int64Array{0, 1, 2, 3, 4, 5, 6}
	}

	if len(task.RecurrenceDays) == 0 {
		return nil, util.ErrInvalidRecurrence
	}

	query := `
		INSERT INTO tasks (
			title, description, is_global, owner_id,
			recurrence_type, recurrence_days, created_by
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, is_active, created_at, updated_at
	`

	row := r.db.QueryRow(
		query,
		task.Title,
		task.Description,
		task.IsGlobal,
		task.OwnerID,
		task.RecurrenceType,
		task.RecurrenceDays,
		task.CreatedBy,
	)

	err := row.Scan(&task.ID, &task.IsActive, &task.CreatedAt, &task.UpdatedAt)
	if err != nil {
		return nil, err
	}

	return &task, nil
}

// ---- Update ----
func (r *taskRepo) Update(id int64, updates TaskUpdate, requestingUserID int64, role string) (*Task, error) {
	existing, err := r.GetByID(id)
	if err != nil {
		return nil, err
	}

	if err := checkOwnership(existing, requestingUserID, role); err != nil {
		return nil, err
	}

	if updates.Title != nil {
		existing.Title = *updates.Title
	}
	if updates.Description != nil {
		existing.Description = sql.NullString{String: *updates.Description, Valid: true}
	}
	if updates.RecurrenceType != nil {
		existing.RecurrenceType = *updates.RecurrenceType
	}
	if updates.RecurrenceDays != nil {
		existing.RecurrenceDays = pq.Int64Array(*updates.RecurrenceDays)
	}
	if existing.RecurrenceType == util.RecurrenceDaily {
		existing.RecurrenceDays = pq.Int64Array{0, 1, 2, 3, 4, 5, 6}
	}
	if len(existing.RecurrenceDays) == 0 {
		return nil, util.ErrInvalidRecurrence
	}
	if updates.IsActive != nil {
		existing.IsActive = *updates.IsActive
	}

	query := `
		UPDATE tasks
		SET title = $1,
		    description = $2,
		    recurrence_type = $3,
		    recurrence_days = $4,
		    is_active = $5,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $6
		RETURNING updated_at
	`

	err = r.db.QueryRow(
		query,
		existing.Title,
		existing.Description,
		existing.RecurrenceType,
		existing.RecurrenceDays,
		existing.IsActive,
		existing.ID,
	).Scan(&existing.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return existing, nil
}

// ---- Delete (hard delete, history অক্ষত থাকবে কারণ task_completions এ ON DELETE SET NULL) ----
func (r *taskRepo) Delete(id int64, requestingUserID int64, role string) error {
	existing, err := r.GetByID(id)
	if err != nil {
		return err
	}

	if err := checkOwnership(existing, requestingUserID, role); err != nil {
		return err
	}

	_, err = r.db.Exec(`DELETE FROM tasks WHERE id = $1`, id)
	return err
}

// ---- GetByID ----
func (r *taskRepo) GetByID(id int64) (*Task, error) {
	var task Task

	err := r.db.Get(&task, `SELECT * FROM tasks WHERE id = $1`, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, util.ErrTaskNotFound
		}
		return nil, err
	}

	return &task, nil
}

// ---- ListForDate: একটা নির্দিষ্ট দিনের জন্য user এর দেখা task + status ----
func (r *taskRepo) ListForDate(userID int64, date time.Time) ([]TaskWithStatus, error) {
	dateStr := date.Format("2026-07-07")
	
	query := `
		SELECT
			t.id, t.title, t.description, t.is_global, t.recurrence_type,
			tc.status, tc.completed_at
		FROM tasks t
		LEFT JOIN task_completions tc
			ON tc.task_id = t.id AND tc.user_id = $1 AND tc.task_date = $2::date
		WHERE t.is_active = true
			AND EXTRACT(DOW FROM $2::date)::int = ANY(t.recurrence_days)
			AND (t.is_global = true OR t.owner_id = $1)
		ORDER BY t.is_global, t.created_at
	`
	

	rows, err := r.db.Query(query, userID, dateStr)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	today := time.Now().Format("2006-01-02")

	var results []TaskWithStatus

	for rows.Next() {
		var item TaskWithStatus
		var desc sql.NullString
		var status sql.NullString
		var completedAt sql.NullTime

		err := rows.Scan(
			&item.TaskID, &item.Title, &desc, &item.IsGlobal,
			&item.RecurrenceType, &status, &completedAt,
		)
		if err != nil {
			return nil, err
		}

		item.Description = desc.String
		item.Date = dateStr

		if status.Valid {
			item.Status = status.String
		} else if dateStr < today {
			item.Status = util.StatusMissed
		} else {
			item.Status = util.StatusPending
		}

		if completedAt.Valid {
			t := completedAt.Time
			item.CompletedAt = &t
		}

		results = append(results, item)
	}

	return results, rows.Err()
}

// ---- ListForRange: history এর জন্য, একাধিক দিন একসাথে ----
func (r *taskRepo) ListForRange(userID int64, from, to time.Time) ([]TaskWithStatus, error) {
	query := `
		SELECT
			d.day, t.id, t.title, t.description, t.is_global, t.recurrence_type,
			tc.status, tc.completed_at
		FROM generate_series($1::date, $2::date, interval '1 day') AS d(day)
		JOIN tasks t
			ON t.is_active = true
			AND EXTRACT(DOW FROM d.day)::int = ANY(t.recurrence_days)
			AND (t.is_global = true OR t.owner_id = $3)
		LEFT JOIN task_completions tc
			ON tc.task_id = t.id AND tc.user_id = $3 AND tc.task_date = d.day
		ORDER BY d.day, t.is_global, t.created_at
	`

	rows, err := r.db.Query(query, from, to, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	today := time.Now().Format("2006-01-02")

	var results []TaskWithStatus

	for rows.Next() {
		var item TaskWithStatus
		var day time.Time
		var desc sql.NullString
		var status sql.NullString
		var completedAt sql.NullTime

		err := rows.Scan(
			&day, &item.TaskID, &item.Title, &desc, &item.IsGlobal,
			&item.RecurrenceType, &status, &completedAt,
		)
		if err != nil {
			return nil, err
		}

		item.Description = desc.String
		item.Date = day.Format("2006-01-02")

		if status.Valid {
			item.Status = status.String
		} else if item.Date < today {
			item.Status = util.StatusMissed
		} else {
			item.Status = util.StatusPending
		}

		if completedAt.Valid {
			t := completedAt.Time
			item.CompletedAt = &t
		}

		results = append(results, item)
	}

	return results, rows.Err()
}

// ---- Complete: upsert করে completion record ----
func (r *taskRepo) Complete(taskID int64, userID int64, date time.Time) (*TaskCompletion, error) {
	task, err := r.GetByID(taskID)
	if err != nil {
		return nil, err
	}

	if !task.IsActive {
		return nil, util.ErrTaskNotFound
	}

	// Access check: personal task হলে owner হতে হবে, নাহলে global হতে হবে
	if !task.IsGlobal && (!task.OwnerID.Valid || task.OwnerID.Int64 != userID) {
		return nil, util.ErrForbidden
	}

	weekday := int64(date.Weekday()) // Go: Sunday=0...Saturday=6, আমাদের DB স্কিমার সাথে ম্যাচ করে
	scheduled := false
	for _, d := range task.RecurrenceDays {
		if d == weekday {
			scheduled = true
			break
		}
	}
	if !scheduled {
		return nil, util.ErrTaskNotScheduled
	}

	var completion TaskCompletion
	dateStr := date.Format("2026-07-07")

	query := `
		INSERT INTO task_completions (
			task_id, user_id, task_title_snapshot, was_global_snapshot,
			task_date, status, completed_at
		)
		VALUES ($1, $2, $3, $4, $5::date, 'completed', CURRENT_TIMESTAMP)
		ON CONFLICT (task_id, user_id, task_date)
		DO UPDATE SET status = 'completed', completed_at = CURRENT_TIMESTAMP
		RETURNING id, task_id, user_id, task_title_snapshot, task_date, status, completed_at, created_at
	`

	err = r.db.QueryRow(
		query, task.ID, userID, task.Title, task.IsGlobal, dateStr,
	).Scan(
		&completion.ID, &completion.TaskID, &completion.UserID,
		&completion.TaskTitleSnapshot, &completion.TaskDate,
		&completion.Status, &completion.CompletedAt, &completion.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &completion, nil
}

// ---- Helper ----
func checkOwnership(task *Task, requestingUserID int64, role string) error {
	if role == "admin" {
		return nil
	}

	if task.IsGlobal {
		// শুধু admin ই global task edit/delete করতে পারবে
		return util.ErrForbidden
	}

	if !task.OwnerID.Valid || task.OwnerID.Int64 != requestingUserID {
		return util.ErrForbidden
	}

	return nil
}
