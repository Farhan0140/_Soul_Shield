package repo

import (
	"database/sql"
	"encoding/json"
	"soulsheld/util"
	"time"

	"github.com/lib/pq"
)

// ---- Push input shapes: decoded from SyncChange.Data per resource/op. All
// fields are pointers/omittable where the corresponding column is nullable
// or only relevant to one op, mirroring the Pull response shapes in
// sync.go one-for-one so a client can round-trip a pulled row straight back
// as a push payload. ----

type syncTaskInput struct {
	Title           string   `json:"title"`
	Description     *string  `json:"description"`
	RecurrenceType  string   `json:"recurrence_type"`
	RecurrenceDays  []int64  `json:"recurrence_days"`
	IsActive        *bool    `json:"is_active"`
	CategoryUUID    *string  `json:"category_uuid"`
	RewardText      *string  `json:"reward_text"`
	TaskType        string   `json:"task_type"`
	TargetCount     *int32   `json:"target_count"`
	DurationSeconds *int32   `json:"duration_seconds"`
	ReminderTime    *string  `json:"reminder_time"`
	SourceTaskUUID  *string  `json:"source_task_uuid"`
	Position        *int     `json:"position"`
}

type syncCategoryInput struct {
	Name     string `json:"name"`
	ColorHex string `json:"color_hex"`
	Position *int   `json:"position"`
}

type syncSubTaskInput struct {
	ParentTaskUUID  string `json:"parent_task_uuid"`
	Title           string `json:"title"`
	TaskType        string `json:"task_type"`
	TargetCount     *int32 `json:"target_count"`
	DurationSeconds *int32 `json:"duration_seconds"`
	Position        *int   `json:"position"`
}

// syncCompletionInput covers both task_completions and sub_task_completions
// pushes: Status is used for op "upsert" (mirrors repo.Complete), Amount
// for op "increment" (mirrors repo.Increment's additive delta - see
// pushTaskCompletion/pushSubTaskCompletion for why this can't be plain LWW).
type syncCompletionInput struct {
	TaskUUID       string `json:"task_uuid"`
	SubTaskUUID    string `json:"sub_task_uuid"`
	ParentTaskUUID string `json:"parent_task_uuid"`
	TaskDate       string `json:"task_date"`
	Status         string `json:"status"`
	Amount         int32  `json:"amount"`
}

func (r *syncRepo) PushChanges(userID int64, changes []SyncChange) ([]SyncChangeResult, error) {
	results := make([]SyncChangeResult, 0, len(changes))
	for _, change := range changes {
		result, err := r.pushOne(userID, change)
		if err != nil {
			// Only genuine DB/infra failures reach here - see pushOne.
			return nil, err
		}
		results = append(results, *result)
	}
	return results, nil
}

func rejected(change SyncChange, err error) *SyncChangeResult {
	return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "rejected", Error: err.Error()}
}

func (r *syncRepo) pushOne(userID int64, change SyncChange) (*SyncChangeResult, error) {
	switch change.Resource {
	case "tasks":
		return r.pushTask(userID, change)
	case "categories":
		return r.pushCategory(userID, change)
	case "sub_tasks":
		return r.pushSubTask(userID, change)
	case "task_completions":
		return r.pushTaskCompletion(userID, change)
	case "sub_task_completions":
		return r.pushSubTaskCompletion(userID, change)
	default:
		return rejected(change, util.ErrInvalidSyncResource), nil
	}
}

// resolveOwnedID looks up an owned/global row's internal id by uuid,
// scoped so a user can never reference (or silently adopt) another user's
// row. Returns 0, false when unresolvable - callers decide whether that's
// fatal (a required parent, e.g. sub_tasks.parent_task_uuid) or fine to
// leave null (an optional relationship, e.g. tasks.category_uuid).
func (r *syncRepo) resolveTaskID(userID int64, uuid *string) (int64, bool, error) {
	if uuid == nil || *uuid == "" {
		return 0, false, nil
	}
	var id int64
	err := r.db.Get(&id, `
		SELECT id FROM tasks WHERE uuid = $1 AND deleted_at IS NULL AND (is_global = true OR owner_id = $2)
	`, *uuid, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, false, nil
		}
		return 0, false, err
	}
	return id, true, nil
}

func (r *syncRepo) resolveCategoryID(userID int64, uuid *string) (int64, bool, error) {
	if uuid == nil || *uuid == "" {
		return 0, false, nil
	}
	var id int64
	err := r.db.Get(&id, `SELECT id FROM categories WHERE uuid = $1 AND owner_id = $2 AND deleted_at IS NULL`, *uuid, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, false, nil
		}
		return 0, false, err
	}
	return id, true, nil
}

// resolveOwnedTaskID is stricter than resolveTaskID: it never matches a
// global task, only one owned outright by userID. Used specifically for
// creating a brand-new sub-task (pushSubTask's upsert/not-found branch) -
// resolveTaskID's normal global-or-owned scope is right for *referencing* an
// existing global task (a sub-task/completion can belong to one, same as
// the regular REST endpoints already allow), but a regular user must not be
// able to inject a new sub-task onto a global task's structure via sync,
// which only admins manage.
func (r *syncRepo) resolveOwnedTaskID(userID int64, uuid string) (int64, bool, error) {
	if uuid == "" {
		return 0, false, nil
	}
	var id int64
	err := r.db.Get(&id, `SELECT id FROM tasks WHERE uuid = $1 AND deleted_at IS NULL AND owner_id = $2 AND is_global = false`, uuid, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, false, nil
		}
		return 0, false, err
	}
	return id, true, nil
}

func (r *syncRepo) resolveSubTaskID(userID int64, uuid *string) (int64, bool, error) {
	if uuid == nil || *uuid == "" {
		return 0, false, nil
	}
	var id int64
	err := r.db.Get(&id, `
		SELECT st.id FROM sub_tasks st
		JOIN tasks t ON t.id = st.parent_task_id
		WHERE st.uuid = $1 AND st.deleted_at IS NULL AND (t.is_global = true OR t.owner_id = $2)
	`, *uuid, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, false, nil
		}
		return 0, false, err
	}
	return id, true, nil
}

// ---- tasks ----

func (r *syncRepo) pushTask(userID int64, change SyncChange) (*SyncChangeResult, error) {
	var existing struct {
		ID        int64        `db:"id"`
		OwnerID   sql.NullInt64 `db:"owner_id"`
		UpdatedAt time.Time    `db:"updated_at"`
	}
	err := r.db.Get(&existing, `SELECT id, owner_id, updated_at FROM tasks WHERE uuid = $1`, change.UUID)
	found := true
	if err == sql.ErrNoRows {
		found = false
	} else if err != nil {
		return nil, err
	}
	if found && (!existing.OwnerID.Valid || existing.OwnerID.Int64 != userID) {
		return rejected(change, util.ErrForbidden), nil
	}

	switch change.Op {
	case "delete":
		if !found {
			// Already gone (or never existed) - deleting is a no-op success.
			return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "accepted"}, nil
		}
		if change.ClientUpdatedAt.Before(existing.UpdatedAt) {
			row, err := r.taskByUUID(change.UUID)
			if err != nil {
				return nil, err
			}
			return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "superseded", ServerRow: row}, nil
		}
		tx, err := r.db.Beginx()
		if err != nil {
			return nil, err
		}
		defer tx.Rollback()
		if _, err := tx.Exec(`UPDATE tasks SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`, existing.ID); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(`
			UPDATE sub_tasks SET deleted_at = CURRENT_TIMESTAMP WHERE parent_task_id = $1 AND deleted_at IS NULL
		`, existing.ID); err != nil {
			return nil, err
		}
		if err := tx.Commit(); err != nil {
			return nil, err
		}
		return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "accepted"}, nil

	case "upsert":
		var input syncTaskInput
		if err := json.Unmarshal(change.Data, &input); err != nil {
			return rejected(change, err), nil
		}
		categoryID, hasCategory, err := r.resolveCategoryID(userID, input.CategoryUUID)
		if err != nil {
			return nil, err
		}
		sourceTaskID, hasSource, err := r.resolveTaskID(userID, input.SourceTaskUUID)
		if err != nil {
			return nil, err
		}

		if found {
			if change.ClientUpdatedAt.Before(existing.UpdatedAt) {
				row, err := r.taskByUUID(change.UUID)
				if err != nil {
					return nil, err
				}
				return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "superseded", ServerRow: row}, nil
			}
			isActive := true
			if input.IsActive != nil {
				isActive = *input.IsActive
			}
			_, err := r.db.Exec(`
				UPDATE tasks SET
					title = $1, description = $2, recurrence_type = $3, recurrence_days = $4,
					is_active = $5, category_id = $6, reward_text = $7, task_type = $8,
					target_count = $9, duration_seconds = $10, reminder_time = $11, source_task_id = $12
				WHERE id = $13
			`, input.Title, input.Description, input.RecurrenceType, pq.Int64Array(input.RecurrenceDays),
				isActive, nullInt64(categoryID, hasCategory), input.RewardText, input.TaskType,
				input.TargetCount, input.DurationSeconds, input.ReminderTime, nullInt64(sourceTaskID, hasSource),
				existing.ID)
			if err != nil {
				return nil, err
			}
		} else {
			_, err := r.db.Exec(`
				INSERT INTO tasks (
					uuid, title, description, is_global, owner_id, recurrence_type, recurrence_days,
					created_by, category_id, reward_text, task_type, target_count, duration_seconds,
					reminder_time, source_task_id, position
				) VALUES ($1,$2,$3,false,$4,$5,$6,$4,$7,$8,$9,$10,$11,$12,$13,$14)
			`, change.UUID, input.Title, input.Description, userID, input.RecurrenceType, pq.Int64Array(input.RecurrenceDays),
				nullInt64(categoryID, hasCategory), input.RewardText, input.TaskType, input.TargetCount,
				input.DurationSeconds, input.ReminderTime, nullInt64(sourceTaskID, hasSource), derefInt(input.Position))
			if err != nil {
				return nil, err
			}
		}

		row, err := r.taskByUUID(change.UUID)
		if err != nil {
			return nil, err
		}
		return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "accepted", ServerRow: row}, nil

	default:
		return rejected(change, util.ErrInvalidSyncOp), nil
	}
}

func (r *syncRepo) taskByUUID(uuid string) (*SyncTask, error) {
	tasks, err := r.pullTasksByUUIDs([]string{uuid})
	if err != nil || len(tasks) == 0 {
		return nil, err
	}
	return &tasks[0], nil
}

// pullTasksByUUIDs re-shapes a small set of tasks into the same SyncTask
// form pull.go returns, for "server_row" in a push result - so the client
// reconciles a rejected/superseded push exactly the same way it would
// reconcile a pulled row, one code path instead of two.
func (r *syncRepo) pullTasksByUUIDs(uuids []string) ([]SyncTask, error) {
	rows, err := r.db.Query(`
		SELECT
			t.uuid, t.title, t.description, t.is_global, t.recurrence_type, t.recurrence_days,
			t.is_active, c.uuid, t.reward_text, t.task_type, t.target_count, t.duration_seconds,
			t.reminder_time, src.uuid, t.position, t.created_at, t.updated_at, t.deleted_at
		FROM tasks t
		LEFT JOIN categories c ON c.id = t.category_id
		LEFT JOIN tasks src ON src.id = t.source_task_id
		WHERE t.uuid = ANY($1)
	`, pq.StringArray(uuids))
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

// ---- categories ----

func (r *syncRepo) pushCategory(userID int64, change SyncChange) (*SyncChangeResult, error) {
	var existing struct {
		ID        int64     `db:"id"`
		OwnerID   int64     `db:"owner_id"`
		UpdatedAt time.Time `db:"updated_at"`
	}
	err := r.db.Get(&existing, `SELECT id, owner_id, updated_at FROM categories WHERE uuid = $1`, change.UUID)
	found := true
	if err == sql.ErrNoRows {
		found = false
	} else if err != nil {
		return nil, err
	}
	if found && existing.OwnerID != userID {
		return rejected(change, util.ErrForbidden), nil
	}

	switch change.Op {
	case "delete":
		if !found {
			return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "accepted"}, nil
		}
		if change.ClientUpdatedAt.Before(existing.UpdatedAt) {
			row, err := r.categoryByUUID(change.UUID)
			if err != nil {
				return nil, err
			}
			return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "superseded", ServerRow: row}, nil
		}
		tx, err := r.db.Beginx()
		if err != nil {
			return nil, err
		}
		defer tx.Rollback()
		if _, err := tx.Exec(`UPDATE categories SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`, existing.ID); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(`UPDATE tasks SET category_id = NULL WHERE category_id = $1`, existing.ID); err != nil {
			return nil, err
		}
		if err := tx.Commit(); err != nil {
			return nil, err
		}
		return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "accepted"}, nil

	case "upsert":
		var input syncCategoryInput
		if err := json.Unmarshal(change.Data, &input); err != nil {
			return rejected(change, err), nil
		}
		if input.ColorHex == "" {
			input.ColorHex = "#CCCCCC"
		}

		if found {
			if change.ClientUpdatedAt.Before(existing.UpdatedAt) {
				row, err := r.categoryByUUID(change.UUID)
				if err != nil {
					return nil, err
				}
				return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "superseded", ServerRow: row}, nil
			}
			if _, err := r.db.Exec(`
				UPDATE categories SET name = $1, color_hex = $2 WHERE id = $3
			`, input.Name, input.ColorHex, existing.ID); err != nil {
				if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
					return rejected(change, util.ErrCategoryExists), nil
				}
				return nil, err
			}
		} else {
			if _, err := r.db.Exec(`
				INSERT INTO categories (uuid, name, color_hex, owner_id, position)
				VALUES ($1, $2, $3, $4, $5)
			`, change.UUID, input.Name, input.ColorHex, userID, derefInt(input.Position)); err != nil {
				if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
					return rejected(change, util.ErrCategoryExists), nil
				}
				return nil, err
			}
		}

		row, err := r.categoryByUUID(change.UUID)
		if err != nil {
			return nil, err
		}
		return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "accepted", ServerRow: row}, nil

	default:
		return rejected(change, util.ErrInvalidSyncOp), nil
	}
}

func (r *syncRepo) categoryByUUID(uuid string) (*SyncCategory, error) {
	var item SyncCategory
	var deletedAt sql.NullTime
	err := r.db.QueryRow(`
		SELECT uuid, name, color_hex, position, created_at, updated_at, deleted_at
		FROM categories WHERE uuid = $1
	`, uuid).Scan(&item.UUID, &item.Name, &item.ColorHex, &item.Position, &item.CreatedAt, &item.UpdatedAt, &deletedAt)
	if err != nil {
		return nil, err
	}
	item.DeletedAt = nullTimePtr(deletedAt)
	return &item, nil
}

// ---- sub_tasks ----

func (r *syncRepo) pushSubTask(userID int64, change SyncChange) (*SyncChangeResult, error) {
	var existing struct {
		ID           int64        `db:"id"`
		ParentTaskID int64        `db:"parent_task_id"`
		OwnerID      sql.NullInt64 `db:"owner_id"`
		UpdatedAt    time.Time    `db:"updated_at"`
	}
	err := r.db.Get(&existing, `
		SELECT st.id, st.parent_task_id, t.owner_id, st.updated_at
		FROM sub_tasks st JOIN tasks t ON t.id = st.parent_task_id
		WHERE st.uuid = $1
	`, change.UUID)
	found := true
	if err == sql.ErrNoRows {
		found = false
	} else if err != nil {
		return nil, err
	}
	if found && (!existing.OwnerID.Valid || existing.OwnerID.Int64 != userID) {
		return rejected(change, util.ErrForbidden), nil
	}

	switch change.Op {
	case "delete":
		if !found {
			return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "accepted"}, nil
		}
		if change.ClientUpdatedAt.Before(existing.UpdatedAt) {
			row, err := r.subTaskByUUID(change.UUID)
			if err != nil {
				return nil, err
			}
			return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "superseded", ServerRow: row}, nil
		}
		if _, err := r.db.Exec(`UPDATE sub_tasks SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`, existing.ID); err != nil {
			return nil, err
		}
		return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "accepted"}, nil

	case "upsert":
		var input syncSubTaskInput
		if err := json.Unmarshal(change.Data, &input); err != nil {
			return rejected(change, err), nil
		}

		var parentTaskID int64
		var hasParent bool
		var err error
		if found {
			// Updating an existing sub-task: its parent is already known
			// (and, since `existing` passed the ownership check above,
			// already confirmed owned/non-global) - resolveTaskID's
			// broader global-or-owned scope just needs to confirm the
			// payload didn't try to move it under a different parent.
			parentTaskID, hasParent, err = r.resolveTaskID(userID, &input.ParentTaskUUID)
		} else {
			// Creating a brand-new sub-task: only allowed under a task the
			// user owns outright (see resolveOwnedTaskID) - never under a
			// global task, which only admins structurally manage.
			parentTaskID, hasParent, err = r.resolveOwnedTaskID(userID, input.ParentTaskUUID)
		}
		if err != nil {
			return nil, err
		}
		if !hasParent {
			return rejected(change, util.ErrSyncParentNotFound), nil
		}

		if found {
			if parentTaskID != existing.ParentTaskID {
				return rejected(change, util.ErrForbidden), nil
			}
			if change.ClientUpdatedAt.Before(existing.UpdatedAt) {
				row, err := r.subTaskByUUID(change.UUID)
				if err != nil {
					return nil, err
				}
				return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "superseded", ServerRow: row}, nil
			}
			if _, err := r.db.Exec(`
				UPDATE sub_tasks SET title = $1, task_type = $2, target_count = $3, duration_seconds = $4
				WHERE id = $5
			`, input.Title, input.TaskType, input.TargetCount, input.DurationSeconds, existing.ID); err != nil {
				return nil, err
			}
		} else {
			if _, err := r.db.Exec(`
				INSERT INTO sub_tasks (uuid, parent_task_id, title, task_type, target_count, duration_seconds, position)
				VALUES ($1, $2, $3, $4, $5, $6, $7)
			`, change.UUID, parentTaskID, input.Title, input.TaskType, input.TargetCount, input.DurationSeconds, derefInt(input.Position)); err != nil {
				return nil, err
			}
		}

		row, err := r.subTaskByUUID(change.UUID)
		if err != nil {
			return nil, err
		}
		return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "accepted", ServerRow: row}, nil

	default:
		return rejected(change, util.ErrInvalidSyncOp), nil
	}
}

func (r *syncRepo) subTaskByUUID(uuid string) (*SyncSubTask, error) {
	var item SyncSubTask
	var targetCount, durationSeconds sql.NullInt32
	var deletedAt sql.NullTime
	err := r.db.QueryRow(`
		SELECT st.uuid, t.uuid, st.title, st.task_type, st.target_count, st.duration_seconds,
			st.position, st.created_at, st.updated_at, st.deleted_at
		FROM sub_tasks st JOIN tasks t ON t.id = st.parent_task_id
		WHERE st.uuid = $1
	`, uuid).Scan(
		&item.UUID, &item.ParentTaskUUID, &item.Title, &item.TaskType, &targetCount, &durationSeconds,
		&item.Position, &item.CreatedAt, &item.UpdatedAt, &deletedAt,
	)
	if err != nil {
		return nil, err
	}
	item.TargetCount = nullInt32Ptr(targetCount)
	item.DurationSeconds = nullInt32Ptr(durationSeconds)
	item.DeletedAt = nullTimePtr(deletedAt)
	return &item, nil
}

// ---- task_completions ----
//
// "increment" is deliberately NOT last-write-wins: two devices each
// incrementing a counter task offline and reconnecting must both count,
// or one device's taps silently vanish (see soul-shield-mobile-app's
// local-first plan, Decision 2). The server adds the delta on top of
// whatever progress_count already holds instead of comparing timestamps at
// all. "upsert" (a plain status/completed_at write, e.g. toggling a normal
// task complete/incomplete) stays timestamp-compared like every other
// resource, since there's nothing to sum there.

func (r *syncRepo) pushTaskCompletion(userID int64, change SyncChange) (*SyncChangeResult, error) {
	var input syncCompletionInput
	if err := json.Unmarshal(change.Data, &input); err != nil {
		return rejected(change, err), nil
	}
	taskID, hasTask, err := r.resolveTaskID(userID, &input.TaskUUID)
	if err != nil {
		return nil, err
	}
	if !hasTask {
		return rejected(change, util.ErrSyncParentNotFound), nil
	}

	switch change.Op {
	case "increment":
		if input.Amount <= 0 {
			return rejected(change, util.ErrInvalidIncrementAmount), nil
		}
		var uuid string
		err := r.db.QueryRow(`
			INSERT INTO task_completions (uuid, task_id, user_id, task_title_snapshot, was_global_snapshot, task_date, status, progress_count)
			SELECT $1, $2, $3, t.title, t.is_global, $4::date, 'pending', $5 FROM tasks t WHERE t.id = $2
			ON CONFLICT (task_id, user_id, task_date)
			DO UPDATE SET progress_count = task_completions.progress_count + $5
			RETURNING uuid
		`, change.UUID, taskID, userID, input.TaskDate, input.Amount).Scan(&uuid)
		if err != nil {
			return nil, err
		}
		row, err := r.taskCompletionByUUID(uuid)
		if err != nil {
			return nil, err
		}
		return &SyncChangeResult{Resource: change.Resource, UUID: uuid, Status: "accepted", ServerRow: row}, nil

	case "upsert":
		var existing struct {
			UUID      string    `db:"uuid"`
			UpdatedAt time.Time `db:"updated_at"`
		}
		err := r.db.Get(&existing, `
			SELECT uuid, updated_at FROM task_completions WHERE task_id = $1 AND user_id = $2 AND task_date = $3::date
		`, taskID, userID, input.TaskDate)
		found := true
		if err == sql.ErrNoRows {
			found = false
		} else if err != nil {
			return nil, err
		}
		if found && change.ClientUpdatedAt.Before(existing.UpdatedAt) {
			row, err := r.taskCompletionByUUID(existing.UUID)
			if err != nil {
				return nil, err
			}
			return &SyncChangeResult{Resource: change.Resource, UUID: existing.UUID, Status: "superseded", ServerRow: row}, nil
		}

		var uuid string
		completedAt := sql.NullTime{}
		if input.Status == util.StatusCompleted {
			completedAt = sql.NullTime{Time: time.Now(), Valid: true}
		}
		err = r.db.QueryRow(`
			INSERT INTO task_completions (uuid, task_id, user_id, task_title_snapshot, was_global_snapshot, task_date, status, completed_at)
			SELECT $1, $2, $3, t.title, t.is_global, $4::date, $5, $6 FROM tasks t WHERE t.id = $2
			ON CONFLICT (task_id, user_id, task_date)
			DO UPDATE SET status = $5, completed_at = $6
			RETURNING uuid
		`, change.UUID, taskID, userID, input.TaskDate, input.Status, completedAt).Scan(&uuid)
		if err != nil {
			return nil, err
		}
		row, err := r.taskCompletionByUUID(uuid)
		if err != nil {
			return nil, err
		}
		return &SyncChangeResult{Resource: change.Resource, UUID: uuid, Status: "accepted", ServerRow: row}, nil

	default:
		return rejected(change, util.ErrInvalidSyncOp), nil
	}
}

func (r *syncRepo) taskCompletionByUUID(uuid string) (*SyncTaskCompletion, error) {
	var item SyncTaskCompletion
	var taskUUID sql.NullString
	var taskDate time.Time
	var completedAt, deletedAt sql.NullTime
	err := r.db.QueryRow(`
		SELECT tc.uuid, t.uuid, tc.task_date, tc.status, tc.progress_count, tc.completed_at,
			tc.created_at, tc.updated_at, tc.deleted_at
		FROM task_completions tc LEFT JOIN tasks t ON t.id = tc.task_id
		WHERE tc.uuid = $1
	`, uuid).Scan(&item.UUID, &taskUUID, &taskDate, &item.Status, &item.ProgressCount, &completedAt,
		&item.CreatedAt, &item.UpdatedAt, &deletedAt)
	if err != nil {
		return nil, err
	}
	item.TaskUUID = nullStringPtr(taskUUID)
	item.TaskDate = taskDate.Format("2006-01-02")
	item.CompletedAt = nullTimePtr(completedAt)
	item.DeletedAt = nullTimePtr(deletedAt)
	return &item, nil
}

// ---- sub_task_completions ---- (same shape/reasoning as task_completions above)

func (r *syncRepo) pushSubTaskCompletion(userID int64, change SyncChange) (*SyncChangeResult, error) {
	var input syncCompletionInput
	if err := json.Unmarshal(change.Data, &input); err != nil {
		return rejected(change, err), nil
	}
	subTaskID, hasSubTask, err := r.resolveSubTaskID(userID, &input.SubTaskUUID)
	if err != nil {
		return nil, err
	}
	if !hasSubTask {
		return rejected(change, util.ErrSyncParentNotFound), nil
	}
	parentTaskID, hasParent, err := r.resolveTaskID(userID, &input.ParentTaskUUID)
	if err != nil {
		return nil, err
	}
	if !hasParent {
		return rejected(change, util.ErrSyncParentNotFound), nil
	}

	switch change.Op {
	case "increment":
		if input.Amount <= 0 {
			return rejected(change, util.ErrInvalidIncrementAmount), nil
		}
		var uuid string
		err := r.db.QueryRow(`
			INSERT INTO sub_task_completions (uuid, sub_task_id, parent_task_id, user_id, sub_task_title_snapshot, task_date, status, progress_count)
			SELECT $1, $2, $3, $4, st.title, $5::date, 'pending', $6 FROM sub_tasks st WHERE st.id = $2
			ON CONFLICT (sub_task_id, user_id, task_date)
			DO UPDATE SET progress_count = sub_task_completions.progress_count + $6
			RETURNING uuid
		`, change.UUID, subTaskID, parentTaskID, userID, input.TaskDate, input.Amount).Scan(&uuid)
		if err != nil {
			return nil, err
		}
		row, err := r.subTaskCompletionByUUID(uuid)
		if err != nil {
			return nil, err
		}
		return &SyncChangeResult{Resource: change.Resource, UUID: uuid, Status: "accepted", ServerRow: row}, nil

	case "upsert":
		var existing struct {
			UUID      string    `db:"uuid"`
			UpdatedAt time.Time `db:"updated_at"`
		}
		err := r.db.Get(&existing, `
			SELECT uuid, updated_at FROM sub_task_completions WHERE sub_task_id = $1 AND user_id = $2 AND task_date = $3::date
		`, subTaskID, userID, input.TaskDate)
		found := true
		if err == sql.ErrNoRows {
			found = false
		} else if err != nil {
			return nil, err
		}
		if found && change.ClientUpdatedAt.Before(existing.UpdatedAt) {
			row, err := r.subTaskCompletionByUUID(existing.UUID)
			if err != nil {
				return nil, err
			}
			return &SyncChangeResult{Resource: change.Resource, UUID: existing.UUID, Status: "superseded", ServerRow: row}, nil
		}

		var uuid string
		completedAt := sql.NullTime{}
		if input.Status == util.StatusCompleted {
			completedAt = sql.NullTime{Time: time.Now(), Valid: true}
		}
		err = r.db.QueryRow(`
			INSERT INTO sub_task_completions (uuid, sub_task_id, parent_task_id, user_id, sub_task_title_snapshot, task_date, status, completed_at)
			SELECT $1, $2, $3, $4, st.title, $5::date, $6, $7 FROM sub_tasks st WHERE st.id = $2
			ON CONFLICT (sub_task_id, user_id, task_date)
			DO UPDATE SET status = $6, completed_at = $7
			RETURNING uuid
		`, change.UUID, subTaskID, parentTaskID, userID, input.TaskDate, input.Status, completedAt).Scan(&uuid)
		if err != nil {
			return nil, err
		}
		row, err := r.subTaskCompletionByUUID(uuid)
		if err != nil {
			return nil, err
		}
		return &SyncChangeResult{Resource: change.Resource, UUID: uuid, Status: "accepted", ServerRow: row}, nil

	default:
		return rejected(change, util.ErrInvalidSyncOp), nil
	}
}

func (r *syncRepo) subTaskCompletionByUUID(uuid string) (*SyncSubTaskCompletion, error) {
	var item SyncSubTaskCompletion
	var subTaskUUID sql.NullString
	var taskDate time.Time
	var completedAt, deletedAt sql.NullTime
	err := r.db.QueryRow(`
		SELECT stc.uuid, st.uuid, pt.uuid, stc.task_date, stc.status, stc.progress_count,
			stc.completed_at, stc.created_at, stc.updated_at, stc.deleted_at
		FROM sub_task_completions stc
		LEFT JOIN sub_tasks st ON st.id = stc.sub_task_id
		JOIN tasks pt ON pt.id = stc.parent_task_id
		WHERE stc.uuid = $1
	`, uuid).Scan(&item.UUID, &subTaskUUID, &item.ParentTaskUUID, &taskDate, &item.Status, &item.ProgressCount,
		&completedAt, &item.CreatedAt, &item.UpdatedAt, &deletedAt)
	if err != nil {
		return nil, err
	}
	item.SubTaskUUID = nullStringPtr(subTaskUUID)
	item.TaskDate = taskDate.Format("2006-01-02")
	item.CompletedAt = nullTimePtr(completedAt)
	item.DeletedAt = nullTimePtr(deletedAt)
	return &item, nil
}

// ---- small helpers ----

func nullInt64(id int64, ok bool) sql.NullInt64 {
	if !ok {
		return sql.NullInt64{}
	}
	return sql.NullInt64{Int64: id, Valid: true}
}

func derefInt(v *int) int {
	if v == nil {
		return 0
	}
	return *v
}
