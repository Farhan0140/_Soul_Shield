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

type SubTaskRepo interface {
	// ReplaceForParent একটা parent task এর জন্য পুরো sub-task লিস্ট replace করে:
	// existing id ম্যাচ করলে update, নতুন (id=0) হলে insert, আর input এ নাই এমন
	// existing row delete (completions ON DELETE SET NULL এর কারণে history থেকে যায়)।
	ReplaceForParent(parentTaskID int64, inputs []SubTask) ([]SubTask, error)
	ListByParentIDs(parentIDs []int64) (map[int64][]SubTask, error)
	ListWithStatusForDate(userID int64, parentTaskIDs []int64, date time.Time) (map[int64][]SubTaskWithStatus, error)
	ListWithStatusForRange(userID int64, parentTaskIDs []int64, from, to time.Time) (map[string]map[int64][]SubTaskWithStatus, error)
	Complete(parentTaskID, subTaskID, userID int64, date time.Time) (*SubTaskCompletion, error)
	Increment(parentTaskID, subTaskID, userID int64, date time.Time, amount int32) (*SubTaskCompletion, error)
}

type subTaskRepo struct {
	db *sqlx.DB
}

func NewSubTaskRepo(db *sqlx.DB) SubTaskRepo {
	return &subTaskRepo{db: db}
}

// ---- ReplaceForParent ----
func (r *subTaskRepo) ReplaceForParent(parentTaskID int64, inputs []SubTask) ([]SubTask, error) {
	// প্রতিটা input validate করছি (task.go এর Create এ যেমন করা হয়)
	for i := range inputs {
		if inputs[i].Title == "" {
			return nil, util.ErrSubTaskTitleRequired
		}
		if inputs[i].TaskType == "" {
			inputs[i].TaskType = "normal"
		}
		if inputs[i].TaskType == "counter" {
			if !inputs[i].TargetCount.Valid || inputs[i].TargetCount.Int32 <= 0 {
				return nil, util.ErrInvalidCounterTarget
			}
			inputs[i].DurationSeconds = sql.NullInt32{}
		} else if inputs[i].TaskType == "timer" {
			if !inputs[i].DurationSeconds.Valid || inputs[i].DurationSeconds.Int32 <= 0 {
				return nil, util.ErrInvalidTimerDuration
			}
			inputs[i].TargetCount = sql.NullInt32{}
		} else {
			inputs[i].TargetCount = sql.NullInt32{}
			inputs[i].DurationSeconds = sql.NullInt32{}
		}
		inputs[i].Position = i
	}

	tx, err := r.db.Beginx()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var existingIDs []int64
	if err := tx.Select(&existingIDs, `SELECT id FROM sub_tasks WHERE parent_task_id = $1`, parentTaskID); err != nil {
		return nil, err
	}
	keep := make(map[int64]bool, len(inputs))

	result := make([]SubTask, len(inputs))
	for i, in := range inputs {
		if in.ID != 0 {
			var updated SubTask
			err := tx.QueryRow(`
				UPDATE sub_tasks
				SET title = $1, task_type = $2, target_count = $3, duration_seconds = $4, position = $5, updated_at = CURRENT_TIMESTAMP
				WHERE id = $6 AND parent_task_id = $7
				RETURNING id, parent_task_id, title, task_type, target_count, duration_seconds, position, created_at, updated_at
			`, in.Title, in.TaskType, in.TargetCount, in.DurationSeconds, in.Position, in.ID, parentTaskID).Scan(
				&updated.ID, &updated.ParentTaskID, &updated.Title, &updated.TaskType,
				&updated.TargetCount, &updated.DurationSeconds, &updated.Position, &updated.CreatedAt, &updated.UpdatedAt,
			)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					return nil, util.ErrSubTaskNotFound
				}
				return nil, err
			}
			result[i] = updated
			keep[updated.ID] = true
		} else {
			var created SubTask
			err := tx.QueryRow(`
				INSERT INTO sub_tasks (parent_task_id, title, task_type, target_count, duration_seconds, position)
				VALUES ($1, $2, $3, $4, $5, $6)
				RETURNING id, parent_task_id, title, task_type, target_count, duration_seconds, position, created_at, updated_at
			`, parentTaskID, in.Title, in.TaskType, in.TargetCount, in.DurationSeconds, in.Position).Scan(
				&created.ID, &created.ParentTaskID, &created.Title, &created.TaskType,
				&created.TargetCount, &created.DurationSeconds, &created.Position, &created.CreatedAt, &created.UpdatedAt,
			)
			if err != nil {
				return nil, err
			}
			result[i] = created
			keep[created.ID] = true
		}
	}

	for _, id := range existingIDs {
		if !keep[id] {
			if _, err := tx.Exec(`DELETE FROM sub_tasks WHERE id = $1`, id); err != nil {
				return nil, err
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return result, nil
}

// ---- ListByParentIDs ----
func (r *subTaskRepo) ListByParentIDs(parentIDs []int64) (map[int64][]SubTask, error) {
	result := make(map[int64][]SubTask)
	if len(parentIDs) == 0 {
		return result, nil
	}

	query := `
		SELECT id, parent_task_id, title, task_type, target_count, duration_seconds, position, created_at, updated_at
		FROM sub_tasks
		WHERE parent_task_id = ANY($1)
		ORDER BY parent_task_id, position, id
	`
	rows, err := r.db.Query(query, pq.Int64Array(parentIDs))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var s SubTask
		if err := rows.Scan(&s.ID, &s.ParentTaskID, &s.Title, &s.TaskType, &s.TargetCount, &s.DurationSeconds, &s.Position, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		result[s.ParentTaskID] = append(result[s.ParentTaskID], s)
	}

	return result, rows.Err()
}

// ---- ListWithStatusForDate ----
func (r *subTaskRepo) ListWithStatusForDate(userID int64, parentTaskIDs []int64, date time.Time) (map[int64][]SubTaskWithStatus, error) {
	result := make(map[int64][]SubTaskWithStatus)
	if len(parentTaskIDs) == 0 {
		return result, nil
	}
	dateStr := date.Format("2006-01-02")
	today := time.Now().Format("2006-01-02")

	query := `
		SELECT
			st.id, st.parent_task_id, st.title, st.task_type, st.target_count, st.duration_seconds, st.position,
			stc.status, stc.completed_at, stc.progress_count
		FROM sub_tasks st
		LEFT JOIN sub_task_completions stc
			ON stc.sub_task_id = st.id AND stc.user_id = $1 AND stc.task_date = $2::date
		WHERE st.parent_task_id = ANY($3)
		ORDER BY st.parent_task_id, st.position, st.id
	`
	rows, err := r.db.Query(query, userID, dateStr, pq.Int64Array(parentTaskIDs))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		item, err := scanSubTaskWithStatus(rows, dateStr, today)
		if err != nil {
			return nil, err
		}
		result[item.ParentTaskID] = append(result[item.ParentTaskID], item)
	}

	return result, rows.Err()
}

// ---- ListWithStatusForRange ----
func (r *subTaskRepo) ListWithStatusForRange(userID int64, parentTaskIDs []int64, from, to time.Time) (map[string]map[int64][]SubTaskWithStatus, error) {
	result := make(map[string]map[int64][]SubTaskWithStatus)
	if len(parentTaskIDs) == 0 {
		return result, nil
	}
	fromStr := from.Format("2006-01-02")
	toStr := to.Format("2006-01-02")
	today := time.Now().Format("2006-01-02")

	query := `
		SELECT
			d.day, st.id, st.parent_task_id, st.title, st.task_type, st.target_count, st.duration_seconds, st.position,
			stc.status, stc.completed_at, stc.progress_count
		FROM generate_series($1::date, $2::date, interval '1 day') AS d(day)
		JOIN sub_tasks st ON st.parent_task_id = ANY($3)
		LEFT JOIN sub_task_completions stc
			ON stc.sub_task_id = st.id AND stc.user_id = $4 AND stc.task_date = d.day
		ORDER BY d.day, st.parent_task_id, st.position, st.id
	`
	rows, err := r.db.Query(query, fromStr, toStr, pq.Int64Array(parentTaskIDs), userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var day time.Time
		var s SubTask
		var status sql.NullString
		var completedAt sql.NullTime
		var progressCount sql.NullInt32

		err := rows.Scan(
			&day, &s.ID, &s.ParentTaskID, &s.Title, &s.TaskType, &s.TargetCount, &s.DurationSeconds, &s.Position,
			&status, &completedAt, &progressCount,
		)
		if err != nil {
			return nil, err
		}

		dayStr := day.Format("2006-01-02")
		item := toSubTaskWithStatus(s, status, completedAt, progressCount, dayStr, today)

		if result[dayStr] == nil {
			result[dayStr] = make(map[int64][]SubTaskWithStatus)
		}
		result[dayStr][item.ParentTaskID] = append(result[dayStr][item.ParentTaskID], item)
	}

	return result, rows.Err()
}

// ---- Complete ----
func (r *subTaskRepo) Complete(parentTaskID, subTaskID, userID int64, date time.Time) (*SubTaskCompletion, error) {
	parent, sub, err := r.getParentAndSubTask(parentTaskID, subTaskID, userID)
	if err != nil {
		return nil, err
	}
	if sub.TaskType == "counter" {
		return nil, util.ErrNotCounterTask
	}
	if err := r.checkScheduled(parent, date); err != nil {
		return nil, err
	}

	dateStr := date.Format("2006-01-02")
	var completion SubTaskCompletion

	query := `
		INSERT INTO sub_task_completions (
			sub_task_id, parent_task_id, user_id, sub_task_title_snapshot,
			task_date, status, completed_at
		)
		VALUES ($1, $2, $3, $4, $5::date, 'completed', CURRENT_TIMESTAMP)
		ON CONFLICT (sub_task_id, user_id, task_date)
		DO UPDATE SET status = 'completed', completed_at = CURRENT_TIMESTAMP
		RETURNING id, sub_task_id, parent_task_id, user_id, sub_task_title_snapshot, task_date, status, progress_count, completed_at, created_at
	`
	err = r.db.QueryRow(query, sub.ID, parentTaskID, userID, sub.Title, dateStr).Scan(
		&completion.ID, &completion.SubTaskID, &completion.ParentTaskID, &completion.UserID,
		&completion.SubTaskTitleSnapshot, &completion.TaskDate,
		&completion.Status, &completion.ProgressCount, &completion.CompletedAt, &completion.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &completion, nil
}

// ---- Increment ----
func (r *subTaskRepo) Increment(parentTaskID, subTaskID, userID int64, date time.Time, amount int32) (*SubTaskCompletion, error) {
	if amount <= 0 {
		return nil, util.ErrInvalidIncrementAmount
	}

	parent, sub, err := r.getParentAndSubTask(parentTaskID, subTaskID, userID)
	if err != nil {
		return nil, err
	}
	if sub.TaskType != "counter" {
		return nil, util.ErrNotCounterTask
	}
	if err := r.checkScheduled(parent, date); err != nil {
		return nil, err
	}

	dateStr := date.Format("2006-01-02")
	target := sub.TargetCount.Int32

	tx, err := r.db.Beginx()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var completion SubTaskCompletion
	err = tx.QueryRow(`
		INSERT INTO sub_task_completions (
			sub_task_id, parent_task_id, user_id, sub_task_title_snapshot,
			task_date, status, progress_count
		)
		VALUES ($1, $2, $3, $4, $5::date, 'pending', $6)
		ON CONFLICT (sub_task_id, user_id, task_date)
		DO UPDATE SET progress_count = sub_task_completions.progress_count + $6
		RETURNING id, sub_task_id, parent_task_id, user_id, sub_task_title_snapshot, task_date, status, progress_count, completed_at, created_at
	`, sub.ID, parentTaskID, userID, sub.Title, dateStr, amount).Scan(
		&completion.ID, &completion.SubTaskID, &completion.ParentTaskID, &completion.UserID,
		&completion.SubTaskTitleSnapshot, &completion.TaskDate,
		&completion.Status, &completion.ProgressCount, &completion.CompletedAt, &completion.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	if completion.ProgressCount >= target && completion.Status != util.StatusCompleted {
		err = tx.QueryRow(`
			UPDATE sub_task_completions
			SET status = 'completed', completed_at = CURRENT_TIMESTAMP
			WHERE id = $1
			RETURNING status, completed_at
		`, completion.ID).Scan(&completion.Status, &completion.CompletedAt)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &completion, nil
}

// ---- Helpers ----

// getParentAndSubTask parent task টা fetch করে (ownership check সহ) এবং নিশ্চিত করে
// sub-task টা সত্যিই ঐ parent এর অধীনে আছে।
func (r *subTaskRepo) getParentAndSubTask(parentTaskID, subTaskID, userID int64) (*Task, *SubTask, error) {
	var parent Task
	err := r.db.Get(&parent, `SELECT * FROM tasks WHERE id = $1`, parentTaskID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil, util.ErrTaskNotFound
		}
		return nil, nil, err
	}
	if !parent.IsActive {
		return nil, nil, util.ErrTaskNotFound
	}
	if !parent.IsGlobal && (!parent.OwnerID.Valid || parent.OwnerID.Int64 != userID) {
		return nil, nil, util.ErrForbidden
	}

	var sub SubTask
	err = r.db.Get(&sub, `SELECT * FROM sub_tasks WHERE id = $1 AND parent_task_id = $2`, subTaskID, parentTaskID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil, util.ErrSubTaskNotFound
		}
		return nil, nil, err
	}

	return &parent, &sub, nil
}

// checkScheduled - sub-task এর নিজের recurrence নাই, parent task এর recurrence_days ব্যবহার করে
// weekday scheduled কিনা চেক করে (task.go এর Complete/Increment এর মতোই)
func (r *subTaskRepo) checkScheduled(parent *Task, date time.Time) error {
	weekday := int64(date.Weekday())
	for _, d := range parent.RecurrenceDays {
		if d == weekday {
			return nil
		}
	}
	return util.ErrTaskNotScheduled
}

func toSubTaskWithStatus(s SubTask, status sql.NullString, completedAt sql.NullTime, progressCount sql.NullInt32, dateStr, today string) SubTaskWithStatus {
	item := SubTaskWithStatus{
		SubTaskID:    s.ID,
		ParentTaskID: s.ParentTaskID,
		Title:        s.Title,
		TaskType:     s.TaskType,
		Position:     s.Position,
	}
	if s.TargetCount.Valid {
		v := s.TargetCount.Int32
		item.TargetCount = &v
	}
	if s.DurationSeconds.Valid {
		v := s.DurationSeconds.Int32
		item.DurationSeconds = &v
	}
	if progressCount.Valid {
		item.ProgressCount = progressCount.Int32
	}
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
	return item
}

type rowScanner interface {
	Scan(dest ...interface{}) error
}

func scanSubTaskWithStatus(rows rowScanner, dateStr, today string) (SubTaskWithStatus, error) {
	var s SubTask
	var status sql.NullString
	var completedAt sql.NullTime
	var progressCount sql.NullInt32

	err := rows.Scan(&s.ID, &s.ParentTaskID, &s.Title, &s.TaskType, &s.TargetCount, &s.DurationSeconds, &s.Position, &status, &completedAt, &progressCount)
	if err != nil {
		return SubTaskWithStatus{}, err
	}

	return toSubTaskWithStatus(s, status, completedAt, progressCount, dateStr, today), nil
}
