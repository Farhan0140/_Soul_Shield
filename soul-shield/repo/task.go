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
	Increment(taskID int64, userID int64, date time.Time, amount int32) (*TaskCompletion, error) // নতুন
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

	if task.TaskType == "" {
		task.TaskType = "normal"
	}
	if task.TaskType == "counter" {
		if !task.TargetCount.Valid || task.TargetCount.Int32 <= 0 {
			return nil, util.ErrInvalidCounterTarget
		}
	} else {
		task.TargetCount = sql.NullInt32{}
	}

	if task.CategoryID.Valid {
		cat, err := r.getCategoryForValidation(task.CategoryID.Int64)
		if err != nil {
			return nil, err
		}
		// personal task হলে category owner ম্যাচ করতে হবে; global task হলে admin এর category হতে হবে
		if !task.IsGlobal && (!task.OwnerID.Valid || cat.OwnerID != task.OwnerID.Int64) {
			return nil, util.ErrForbidden
		}
	}

	query := `
		INSERT INTO tasks (
			title, description, is_global, owner_id,
			recurrence_type, recurrence_days, created_by,
			category_id, reward_text, task_type, target_count, reminder_time
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		RETURNING id, is_active, created_at, updated_at
	`

	row := r.db.QueryRow(
		query,
		task.Title, task.Description, task.IsGlobal, task.OwnerID,
		task.RecurrenceType, task.RecurrenceDays, task.CreatedBy,
		task.CategoryID, task.RewardText, task.TaskType, task.TargetCount, task.ReminderTime,
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

	if updates.CategoryID != nil {
		if *updates.CategoryID == 0 {
			existing.CategoryID = sql.NullInt64{}
		} else {
			cat, err := r.getCategoryForValidation(*updates.CategoryID)
			if err != nil {
				return nil, err
			}
			if !existing.IsGlobal && (!existing.OwnerID.Valid || cat.OwnerID != existing.OwnerID.Int64) {
				return nil, util.ErrForbidden
			}
			existing.CategoryID = sql.NullInt64{Int64: *updates.CategoryID, Valid: true}
		}
	}
	if updates.RewardText != nil {
		existing.RewardText = sql.NullString{String: *updates.RewardText, Valid: *updates.RewardText != ""}
	}
	if updates.TargetCount != nil {
		if existing.TaskType == "counter" {
			if *updates.TargetCount <= 0 {
				return nil, util.ErrInvalidCounterTarget
			}
			existing.TargetCount = sql.NullInt32{Int32: *updates.TargetCount, Valid: true}
		}
	}
	if updates.ReminderTime != nil {
		existing.ReminderTime = sql.NullString{String: *updates.ReminderTime, Valid: *updates.ReminderTime != ""}
	}

	query := `
		UPDATE tasks
		SET title = $1,
		    description = $2,
		    recurrence_type = $3,
		    recurrence_days = $4,
		    is_active = $5,
		    category_id = $6,
		    reward_text = $7,
		    target_count = $8,
		    reminder_time = $9,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $10
		RETURNING updated_at
	`

	err = r.db.QueryRow(
		query,
		existing.Title,
		existing.Description,
		existing.RecurrenceType,
		existing.RecurrenceDays,
		existing.IsActive,
		existing.CategoryID,
		existing.RewardText,
		existing.TargetCount,
		existing.ReminderTime,
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
	dateStr := date.Format("2006-01-02")

	query := `
		SELECT
			t.id, t.title, t.description, t.is_global, t.recurrence_type,
			t.task_type, t.target_count,
			c.id AS cat_id, c.name AS cat_name, c.color_hex AS cat_color,
			t.reward_text, t.recurrence_days, t.reminder_time,
			tc.status, tc.completed_at, tc.progress_count
		FROM tasks t
		LEFT JOIN categories c ON c.id = t.category_id
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
		var desc, rewardText, reminderTime sql.NullString
		var status sql.NullString
		var completedAt sql.NullTime
		var catID sql.NullInt64
		var catName, catColor sql.NullString
		var targetCount sql.NullInt32
		var progressCount sql.NullInt32
		var recurrenceDays pq.Int64Array

		err := rows.Scan(
			&item.TaskID, &item.Title, &desc, &item.IsGlobal, &item.RecurrenceType,
			&item.TaskType, &targetCount,
			&catID, &catName, &catColor,
			&rewardText, &recurrenceDays, &reminderTime,
			&status, &completedAt, &progressCount,
		)
		if err != nil {
			return nil, err
		}

		item.Description = desc.String
		item.Date = dateStr
		item.RecurrenceDays = []int64(recurrenceDays)
		if reminderTime.Valid {
			rt := reminderTime.String
			item.ReminderTime = &rt
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
		if progressCount.Valid {
			item.ProgressCount = progressCount.Int32
		}
		if targetCount.Valid {
			v := targetCount.Int32
			item.TargetCount = &v
		}
		if catID.Valid {
			id := catID.Int64
			name := catName.String
			color := catColor.String
			item.CategoryID = &id
			item.CategoryName = &name
			item.CategoryColor = &color
		}
		// reward text শুধু completed হলেই দেখাবো - motivation এর জন্য
		if item.Status == util.StatusCompleted && rewardText.Valid {
			rt := rewardText.String
			item.RewardText = &rt
		}

		results = append(results, item)
	}

	return results, rows.Err()
}

// ---- ListForRange: history এর জন্য, একাধিক দিন একসাথে ----
func (r *taskRepo) ListForRange(userID int64, from, to time.Time) ([]TaskWithStatus, error) {
	fromStr := from.Format("2006-01-02")
	toStr := to.Format("2006-01-02")

	query := `
		SELECT
			d.day, t.id, t.title, t.description, t.is_global, t.recurrence_type,
			t.task_type, t.target_count,
			c.id AS cat_id, c.name AS cat_name, c.color_hex AS cat_color,
			t.reward_text, t.recurrence_days, t.reminder_time,
			tc.status, tc.completed_at, tc.progress_count
		FROM generate_series($1::date, $2::date, interval '1 day') AS d(day)
		JOIN tasks t
			ON t.is_active = true
			AND EXTRACT(DOW FROM d.day)::int = ANY(t.recurrence_days)
			AND (t.is_global = true OR t.owner_id = $3)
		LEFT JOIN categories c ON c.id = t.category_id
		LEFT JOIN task_completions tc
			ON tc.task_id = t.id AND tc.user_id = $3 AND tc.task_date = d.day
		ORDER BY d.day, t.is_global, t.created_at
	`

	rows, err := r.db.Query(query, fromStr, toStr, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	today := time.Now().Format("2006-01-02")
	var results []TaskWithStatus

	for rows.Next() {
		var item TaskWithStatus
		var day time.Time
		var desc, rewardText, reminderTime sql.NullString
		var status sql.NullString
		var completedAt sql.NullTime
		var catID sql.NullInt64
		var catName, catColor sql.NullString
		var targetCount sql.NullInt32
		var progressCount sql.NullInt32
		var recurrenceDays pq.Int64Array

		err := rows.Scan(
			&day, &item.TaskID, &item.Title, &desc, &item.IsGlobal, &item.RecurrenceType,
			&item.TaskType, &targetCount,
			&catID, &catName, &catColor,
			&rewardText, &recurrenceDays, &reminderTime,
			&status, &completedAt, &progressCount,
		)
		if err != nil {
			return nil, err
		}

		item.Description = desc.String
		item.Date = day.Format("2006-01-02")
		item.RecurrenceDays = []int64(recurrenceDays)
		if reminderTime.Valid {
			rt := reminderTime.String
			item.ReminderTime = &rt
		}

		// status না থাকলে (মানে কোনো completion row নাই): তারিখটা আজকের আগে হলে "missed",
		// আজকে বা ভবিষ্যতে হলে "pending"
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
		if progressCount.Valid {
			item.ProgressCount = progressCount.Int32
		}
		if targetCount.Valid {
			v := targetCount.Int32
			item.TargetCount = &v
		}
		if catID.Valid {
			id := catID.Int64
			name := catName.String
			color := catColor.String
			item.CategoryID = &id
			item.CategoryName = &name
			item.CategoryColor = &color
		}
		// reward text শুধু completed অবস্থাতেই response এ দেখাবো
		if item.Status == util.StatusCompleted && rewardText.Valid {
			rt := rewardText.String
			item.RewardText = &rt
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
	if task.TaskType == "counter" {
		return nil, util.ErrNotCounterTask // ভুল endpoint, Increment ব্যবহার করতে হবে
	}
	if !task.IsGlobal && (!task.OwnerID.Valid || task.OwnerID.Int64 != userID) {
		return nil, util.ErrForbidden
	}

	weekday := int64(date.Weekday())
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

	dateStr := date.Format("2006-01-02")
	var completion TaskCompletion

	query := `
		INSERT INTO task_completions (
			task_id, user_id, task_title_snapshot, was_global_snapshot,
			task_date, status, completed_at
		)
		VALUES ($1, $2, $3, $4, $5::date, 'completed', CURRENT_TIMESTAMP)
		ON CONFLICT (task_id, user_id, task_date)
		DO UPDATE SET status = 'completed', completed_at = CURRENT_TIMESTAMP
		RETURNING id, task_id, user_id, task_title_snapshot, task_date, status, progress_count, completed_at, created_at
	`

	err = r.db.QueryRow(query, task.ID, userID, task.Title, task.IsGlobal, dateStr).
		Scan(&completion.ID, &completion.TaskID, &completion.UserID,
			&completion.TaskTitleSnapshot, &completion.TaskDate,
			&completion.Status, &completion.ProgressCount, &completion.CompletedAt, &completion.CreatedAt)

	if err != nil {
		return nil, err
	}

	if completion.Status == util.StatusCompleted && task.RewardText.Valid {
		rewardText := task.RewardText.String
		completion.RewardText = &rewardText
	}

	return &completion, nil
}

func (r *taskRepo) Increment(taskID int64, userID int64, date time.Time, amount int32) (*TaskCompletion, error) {
	if amount <= 0 {
		return nil, util.ErrInvalidIncrementAmount
	}

	task, err := r.GetByID(taskID)
	if err != nil {
		return nil, err
	}
	if !task.IsActive {
		return nil, util.ErrTaskNotFound
	}
	if task.TaskType != "counter" {
		return nil, util.ErrNotCounterTask
	}
	if !task.IsGlobal && (!task.OwnerID.Valid || task.OwnerID.Int64 != userID) {
		return nil, util.ErrForbidden
	}

	weekday := int64(date.Weekday())
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

	dateStr := date.Format("2006-01-02")
	target := task.TargetCount.Int32
	
	tx, err := r.db.Beginx()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var completion TaskCompletion
	err = tx.QueryRow(`
		INSERT INTO task_completions (
			task_id, user_id, task_title_snapshot, was_global_snapshot,
			task_date, status, progress_count
		)
		VALUES ($1, $2, $3, $4, $5::date, 'pending', $6)
		ON CONFLICT (task_id, user_id, task_date)
		DO UPDATE SET progress_count = task_completions.progress_count + $6
		RETURNING id, task_id, user_id, task_title_snapshot, task_date, status, progress_count, completed_at, created_at
	`, task.ID, userID, task.Title, task.IsGlobal, dateStr, amount).Scan(
		&completion.ID, &completion.TaskID, &completion.UserID,
		&completion.TaskTitleSnapshot, &completion.TaskDate,
		&completion.Status, &completion.ProgressCount, &completion.CompletedAt, &completion.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	if completion.ProgressCount >= target && completion.Status != util.StatusCompleted {
		err = tx.QueryRow(`
			UPDATE task_completions
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

	if completion.Status == util.StatusCompleted && task.RewardText.Valid {
		rewardText := task.RewardText.String
		completion.RewardText = &rewardText
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

// ছোট হেল্পার - শুধু category exist করে কিনা আর owner_id বের করার জন্য
func (r *taskRepo) getCategoryForValidation(id int64) (*Category, error) {
	var cat Category
	err := r.db.Get(&cat, `SELECT * FROM categories WHERE id = $1`, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, util.ErrCategoryNotFound
		}
		return nil, err
	}
	return &cat, nil
}