package repo

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"soulsheld/util"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

// ---- Push input shapes: decoded from SyncChange.Data per resource/op. All
// fields are pointers/omittable where the corresponding column is nullable
// or only relevant to one op, mirroring the Pull response shapes in
// sync.go one-for-one so a client can round-trip a pulled row straight back
// as a push payload. ----

type syncTaskInput struct {
	Title           string  `json:"title"`
	Description     *string `json:"description"`
	RecurrenceType  string  `json:"recurrence_type"`
	RecurrenceDays  []int64 `json:"recurrence_days"`
	IsActive        *bool   `json:"is_active"`
	CategoryUUID    *string `json:"category_uuid"`
	RewardText      *string `json:"reward_text"`
	TaskType        string  `json:"task_type"`
	TargetCount     *int32  `json:"target_count"`
	DurationSeconds *int32  `json:"duration_seconds"`
	ReminderTime    *string `json:"reminder_time"`
	SourceTaskUUID  *string `json:"source_task_uuid"`
	Position        *int    `json:"position"`
}

type syncCategoryInput struct {
	Name     string `json:"name"`
	ColorHex string `json:"color_hex"`
	Position *int   `json:"position"`
}

type syncSubTaskInput struct {
	ParentTaskUUID  string  `json:"parent_task_uuid"`
	Title           string  `json:"title"`
	Description     *string `json:"description"`
	TaskType        string  `json:"task_type"`
	TargetCount     *int32  `json:"target_count"`
	DurationSeconds *int32  `json:"duration_seconds"`
	Position        *int    `json:"position"`
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

// MaxSyncBatchChanges caps one POST /sync body (S6). The mobile client
// pushes in chunks well below this.
const MaxSyncBatchChanges = 500

// clockSkewLogThreshold: a client_updated_at further than this ahead of the
// server clock gets logged (B16 diagnostics).
const clockSkewLogThreshold = 5 * time.Minute

// pushRun is one PushChanges call: every statement goes through q (a
// transaction), and uuid -> id lookups are cached for the batch (C2).
type pushRun struct {
	q      *sqlx.Tx
	userID int64
	// latestDate: completions for a later task_date are rejected (B8).
	latestDate time.Time
	now        time.Time

	// Positive-only caches (a uuid missing now may be created by a later
	// change in the same batch, so misses are never cached).
	taskIDs     map[string]int64
	categoryIDs map[string]int64
	subTaskIDs  map[string]int64
}

// PushChanges applies a batch of client changes and returns one result per
// change (accepted / superseded / rejected).
//
// Fast path (C2): the whole batch runs in ONE transaction - one commit
// instead of one per statement, and uuid references are resolved for the
// whole batch up front. If any change hits a per-change data error, the
// fast attempt is rolled back (nothing from it persists) and the batch is
// re-run with a SAVEPOINT around each change, so that one change is rejected
// and the others still apply. Rejections are rare, so the extra savepoint
// round-trips are only paid when needed.
func (r *syncRepo) PushChanges(userID int64, changes []SyncChange, latestDate time.Time) ([]SyncChangeResult, error) {
	results, err := r.pushBatch(userID, changes, latestDate, false)
	if errors.Is(err, errRetryWithSavepoints) {
		return r.pushBatch(userID, changes, latestDate, true)
	}
	return results, err
}

var errRetryWithSavepoints = errors.New("sync push: retry batch with savepoints")

// uuidPattern matches the canonical (lowercase, as Postgres prints it) form.
var uuidPattern = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

func (r *syncRepo) pushBatch(userID int64, changes []SyncChange, latestDate time.Time, isolate bool) ([]SyncChangeResult, error) {
	tx, err := r.db.Beginx()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	run := &pushRun{
		q: tx, userID: userID, latestDate: latestDate, now: time.Now(),
		taskIDs: map[string]int64{}, categoryIDs: map[string]int64{}, subTaskIDs: map[string]int64{},
	}
	if err := run.prefetch(changes); err != nil {
		return nil, err
	}

	results := make([]SyncChangeResult, 0, len(changes))
	for i, change := range changes {
		if isolate {
			if _, err := tx.Exec(fmt.Sprintf("SAVEPOINT sync_change_%d", i)); err != nil {
				return nil, err
			}
		}
		result, err := run.pushOne(change)
		if err != nil {
			// A data-rule violation (class 23: empty title, counter task
			// with no target, ...) or an unparseable value (class 22: bad
			// date, malformed uuid, ...) is that ONE change's problem -
			// reject it individually so it can't take every other queued
			// change in the batch down with it and leave the client retrying
			// the same poisoned batch forever. Anything else is a genuine
			// DB/infra failure and still aborts the request.
			if !isRejectableDataError(err) {
				return nil, err
			}
			if !isolate {
				// The failed statement aborted the whole transaction.
				return nil, errRetryWithSavepoints
			}
			if _, rbErr := tx.Exec(fmt.Sprintf("ROLLBACK TO SAVEPOINT sync_change_%d", i)); rbErr != nil {
				return nil, rbErr
			}
			// Log it server-side and name the constraint in the reply:
			// a silently-dropped change is otherwise impossible to
			// diagnose from either end.
			slog.Warn("sync push: change rejected", "user_id", userID, "resource", change.Resource,
				"uuid", change.UUID, "op", change.Op, "error", err)
			results = append(results, *rejected(change,
				fmt.Errorf("%w [%s]", util.ErrSyncInvalidData, rejectionDetail(err))))
			continue
		}
		if isolate {
			if _, err := tx.Exec(fmt.Sprintf("RELEASE SAVEPOINT sync_change_%d", i)); err != nil {
				return nil, err
			}
		}
		results = append(results, *result)
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return results, nil
}

// prefetch resolves every task / category / sub-task uuid the batch
// references in three queries, instead of one query per reference.
func (p *pushRun) prefetch(changes []SyncChange) error {
	var taskUUIDs, categoryUUIDs, subTaskUUIDs []string
	for _, c := range changes {
		var refs struct {
			CategoryUUID   *string `json:"category_uuid"`
			SourceTaskUUID *string `json:"source_task_uuid"`
			ParentTaskUUID string  `json:"parent_task_uuid"`
			TaskUUID       string  `json:"task_uuid"`
			SubTaskUUID    string  `json:"sub_task_uuid"`
		}
		_ = json.Unmarshal(c.Data, &refs) // malformed data is rejected later, per change
		if refs.CategoryUUID != nil && *refs.CategoryUUID != "" {
			categoryUUIDs = append(categoryUUIDs, *refs.CategoryUUID)
		}
		if refs.SourceTaskUUID != nil && *refs.SourceTaskUUID != "" {
			taskUUIDs = append(taskUUIDs, *refs.SourceTaskUUID)
		}
		for _, u := range []string{refs.ParentTaskUUID, refs.TaskUUID} {
			if u != "" {
				taskUUIDs = append(taskUUIDs, u)
			}
		}
		if refs.SubTaskUUID != "" {
			subTaskUUIDs = append(subTaskUUIDs, refs.SubTaskUUID)
		}
	}

	type idRow struct {
		UUID string `db:"uuid"`
		ID   int64  `db:"id"`
	}
	load := func(dst map[string]int64, uuids []string, query string) error {
		if len(uuids) == 0 {
			return nil
		}
		// Only well-formed uuids go into the uuid[] parameter: one malformed
		// value would otherwise fail the cast for the whole prefetch. (That
		// change is still rejected on its own later.)
		valid := make([]string, 0, len(uuids))
		for _, u := range uuids {
			if uuidPattern.MatchString(u) {
				valid = append(valid, u)
			}
		}
		if len(valid) == 0 {
			return nil
		}
		var rows []idRow
		if err := p.q.Select(&rows, query, pq.StringArray(valid), p.userID); err != nil {
			return err
		}
		for _, row := range rows {
			dst[row.UUID] = row.ID
		}
		return nil
	}
	if err := load(p.taskIDs, taskUUIDs, `
		SELECT uuid::text AS uuid, id FROM tasks
		WHERE uuid = ANY($1::uuid[]) AND deleted_at IS NULL AND (is_global = true OR owner_id = $2)`); err != nil {
		return err
	}
	if err := load(p.categoryIDs, categoryUUIDs, `
		SELECT uuid::text AS uuid, id FROM categories
		WHERE uuid = ANY($1::uuid[]) AND owner_id = $2 AND deleted_at IS NULL`); err != nil {
		return err
	}
	return load(p.subTaskIDs, subTaskUUIDs, `
		SELECT st.uuid::text AS uuid, st.id FROM sub_tasks st JOIN tasks t ON t.id = st.parent_task_id
		WHERE st.uuid = ANY($1::uuid[]) AND st.deleted_at IS NULL AND (t.is_global = true OR t.owner_id = $2)`)
}

// serverWins decides an update/delete conflict against the server row's
// updated_at (B16).
//
//   - base_updated_at sent (the server updated_at this device last saw): if
//     the server row hasn't changed since, the client's edit simply applies,
//     whatever either clock says. Only a REAL concurrent edit falls through
//     to the timestamp comparison below.
//   - Timestamp comparison: client_updated_at is capped at the server's
//     current time, so a phone whose clock runs ahead can't win every
//     conflict (and can't pre-empt edits made later on another device).
func (p *pushRun) serverWins(change SyncChange, serverUpdatedAt time.Time) bool {
	if change.BaseUpdatedAt != nil &&
		!serverUpdatedAt.Truncate(time.Microsecond).After(change.BaseUpdatedAt.Truncate(time.Microsecond)) {
		return false
	}
	clientAt := change.ClientUpdatedAt
	if clientAt.After(p.now) {
		if skew := clientAt.Sub(p.now); skew > clockSkewLogThreshold {
			slog.Warn("sync push: client clock ahead of server", "user_id", p.userID,
				"skew_seconds", int64(skew.Seconds()), "resource", change.Resource)
		}
		clientAt = p.now
	}
	return clientAt.Before(serverUpdatedAt)
}

// checkTaskDate validates a completion's task_date: parseable and not after
// the caller's today (B8). Returns a rejection reason, or nil.
func (p *pushRun) checkTaskDate(raw string) error {
	date, err := time.Parse(util.DateLayout, raw)
	if err != nil {
		return util.ErrSyncInvalidData
	}
	if date.After(p.latestDate) {
		return util.ErrFutureDate
	}
	return nil
}

// guarded runs fn (one statement) under its own savepoint. Use it where the
// caller turns a statement error into a per-change rejection: in Postgres a
// failed statement otherwise aborts the whole batch transaction.
func (p *pushRun) guarded(fn func() error) error {
	if _, err := p.q.Exec("SAVEPOINT guarded_stmt"); err != nil {
		return err
	}
	if err := fn(); err != nil {
		if _, rbErr := p.q.Exec("ROLLBACK TO SAVEPOINT guarded_stmt"); rbErr != nil {
			return rbErr
		}
		return err
	}
	_, err := p.q.Exec("RELEASE SAVEPOINT guarded_stmt")
	return err
}

func rejected(change SyncChange, err error) *SyncChangeResult {
	return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "rejected", Error: err.Error()}
}

func (p *pushRun) pushOne(change SyncChange) (*SyncChangeResult, error) {
	switch change.Resource {
	case "tasks":
		return p.pushTask(change)
	case "categories":
		return p.pushCategory(change)
	case "sub_tasks":
		return p.pushSubTask(change)
	case "task_completions":
		return p.pushTaskCompletion(change)
	case "sub_task_completions":
		return p.pushSubTaskCompletion(change)
	default:
		return rejected(change, util.ErrInvalidSyncResource), nil
	}
}

// resolveOwnedID looks up an owned/global row's internal id by uuid,
// scoped so a user can never reference (or silently adopt) another user's
// row. Returns 0, false when unresolvable - callers decide whether that's
// fatal (a required parent, e.g. sub_tasks.parent_task_uuid) or fine to
// leave null (an optional relationship, e.g. tasks.category_uuid).
func (p *pushRun) resolveTaskID(userID int64, uuid *string) (int64, bool, error) {
	if uuid == nil || *uuid == "" {
		return 0, false, nil
	}
	if id, ok := p.taskIDs[*uuid]; ok {
		return id, true, nil
	}
	var id int64
	err := p.q.Get(&id, `
		SELECT id FROM tasks WHERE uuid = $1 AND deleted_at IS NULL AND (is_global = true OR owner_id = $2)
	`, *uuid, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, false, nil
		}
		return 0, false, err
	}
	p.taskIDs[*uuid] = id
	return id, true, nil
}

func (p *pushRun) resolveCategoryID(userID int64, uuid *string) (int64, bool, error) {
	if uuid == nil || *uuid == "" {
		return 0, false, nil
	}
	if id, ok := p.categoryIDs[*uuid]; ok {
		return id, true, nil
	}
	var id int64
	err := p.q.Get(&id, `SELECT id FROM categories WHERE uuid = $1 AND owner_id = $2 AND deleted_at IS NULL`, *uuid, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, false, nil
		}
		return 0, false, err
	}
	p.categoryIDs[*uuid] = id
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
func (p *pushRun) resolveOwnedTaskID(userID int64, uuid string) (int64, bool, error) {
	if uuid == "" {
		return 0, false, nil
	}
	var id int64
	err := p.q.Get(&id, `SELECT id FROM tasks WHERE uuid = $1 AND deleted_at IS NULL AND owner_id = $2 AND is_global = false`, uuid, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, false, nil
		}
		return 0, false, err
	}
	return id, true, nil
}

func (p *pushRun) resolveSubTaskID(userID int64, uuid *string) (int64, bool, error) {
	if uuid == nil || *uuid == "" {
		return 0, false, nil
	}
	if id, ok := p.subTaskIDs[*uuid]; ok {
		return id, true, nil
	}
	var id int64
	err := p.q.Get(&id, `
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
	p.subTaskIDs[*uuid] = id
	return id, true, nil
}

// ---- tasks ----

func (p *pushRun) pushTask(change SyncChange) (*SyncChangeResult, error) {
	userID := p.userID
	var existing struct {
		ID        int64         `db:"id"`
		OwnerID   sql.NullInt64 `db:"owner_id"`
		UpdatedAt time.Time     `db:"updated_at"`
	}
	err := p.q.Get(&existing, `SELECT id, owner_id, updated_at FROM tasks WHERE uuid = $1`, change.UUID)
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
		if p.serverWins(change, existing.UpdatedAt) {
			row, err := p.taskByUUID(change.UUID)
			if err != nil {
				return nil, err
			}
			return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "superseded", ServerRow: row}, nil
		}
		// Already inside the batch transaction: these writes commit together.
		if _, err := p.q.Exec(`UPDATE tasks SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`, existing.ID); err != nil {
			return nil, err
		}
		if _, err := p.q.Exec(`
			UPDATE sub_tasks SET deleted_at = CURRENT_TIMESTAMP WHERE parent_task_id = $1 AND deleted_at IS NULL
		`, existing.ID); err != nil {
			return nil, err
		}
		delete(p.taskIDs, change.UUID)
		p.subTaskIDs = map[string]int64{} // its sub-tasks were soft-deleted too
		return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "accepted"}, nil

	case "upsert":
		var input syncTaskInput
		if err := json.Unmarshal(change.Data, &input); err != nil {
			return rejected(change, err), nil
		}
		// "" is the client's way of saying "no reminder" (the REST API's
		// convention for clearing one) but the column only accepts NULL or
		// HH:MM - passed through, it failed the CHECK and the edit that
		// turned a reminder off never reached the server.
		if input.ReminderTime != nil && *input.ReminderTime == "" {
			input.ReminderTime = nil
		}
		categoryID, hasCategory, err := p.resolveCategoryID(userID, input.CategoryUUID)
		if err != nil {
			return nil, err
		}
		sourceTaskID, hasSource, err := p.resolveTaskID(userID, input.SourceTaskUUID)
		if err != nil {
			return nil, err
		}

		if found {
			if p.serverWins(change, existing.UpdatedAt) {
				row, err := p.taskByUUID(change.UUID)
				if err != nil {
					return nil, err
				}
				return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "superseded", ServerRow: row}, nil
			}
			isActive := true
			if input.IsActive != nil {
				isActive = *input.IsActive
			}
			_, err := p.q.Exec(`
				UPDATE tasks SET
					title = $1, description = $2, recurrence_type = $3, recurrence_days = $4,
					is_active = $5, category_id = $6, reward_text = $7, task_type = $8,
					target_count = $9, duration_seconds = $10, reminder_time = $11, source_task_id = $12,
					position = COALESCE($13, position)
				WHERE id = $14
			`, input.Title, input.Description, input.RecurrenceType, pq.Int64Array(input.RecurrenceDays),
				isActive, nullInt64(categoryID, hasCategory), input.RewardText, input.TaskType,
				input.TargetCount, input.DurationSeconds, input.ReminderTime, nullInt64(sourceTaskID, hasSource),
				input.Position, existing.ID)
			if err != nil {
				return nil, err
			}
		} else {
			_, err := p.q.Exec(`
				INSERT INTO tasks (
					uuid, title, description, is_global, owner_id, recurrence_type, recurrence_days,
					created_by, category_id, reward_text, task_type, target_count, duration_seconds,
					reminder_time, source_task_id, position
				) VALUES ($1,$2,$3,false,$4,$5,$6,$4,$7,$8,$9,$10,$11,$12,$13,$14)
				ON CONFLICT (uuid) DO NOTHING
			`, change.UUID, input.Title, input.Description, userID, input.RecurrenceType, pq.Int64Array(input.RecurrenceDays),
				nullInt64(categoryID, hasCategory), input.RewardText, input.TaskType, input.TargetCount,
				input.DurationSeconds, input.ReminderTime, nullInt64(sourceTaskID, hasSource), derefInt(input.Position))
			// ON CONFLICT (uuid): a duplicate uuid means this same change already
			// landed (an overlapping push, or a retry whose first attempt
			// committed) - idempotent success. (It must not be a swallowed
			// error: inside the batch transaction any failed statement aborts
			// the transaction.)
			if err != nil {
				return nil, err
			}
		}

		row, err := p.taskByUUID(change.UUID)
		if err != nil {
			return nil, err
		}
		return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "accepted", ServerRow: row}, nil

	default:
		return rejected(change, util.ErrInvalidSyncOp), nil
	}
}

func (p *pushRun) taskByUUID(uuid string) (*SyncTask, error) {
	tasks, err := p.pullTasksByUUIDs([]string{uuid})
	if err != nil || len(tasks) == 0 {
		return nil, err
	}
	return &tasks[0], nil
}

// pullTasksByUUIDs re-shapes a small set of tasks into the same SyncTask
// form pull.go returns, for "server_row" in a push result - so the client
// reconciles a rejected/superseded push exactly the same way it would
// reconcile a pulled row, one code path instead of two.
func (p *pushRun) pullTasksByUUIDs(uuids []string) ([]SyncTask, error) {
	rows, err := p.q.Query(`
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

func (p *pushRun) pushCategory(change SyncChange) (*SyncChangeResult, error) {
	userID := p.userID
	var existing struct {
		ID        int64     `db:"id"`
		OwnerID   int64     `db:"owner_id"`
		UpdatedAt time.Time `db:"updated_at"`
	}
	err := p.q.Get(&existing, `SELECT id, owner_id, updated_at FROM categories WHERE uuid = $1`, change.UUID)
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
		if p.serverWins(change, existing.UpdatedAt) {
			row, err := p.categoryByUUID(change.UUID)
			if err != nil {
				return nil, err
			}
			return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "superseded", ServerRow: row}, nil
		}
		// Already inside the batch transaction: these writes commit together.
		if _, err := p.q.Exec(`UPDATE categories SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`, existing.ID); err != nil {
			return nil, err
		}
		if _, err := p.q.Exec(`UPDATE tasks SET category_id = NULL WHERE category_id = $1`, existing.ID); err != nil {
			return nil, err
		}
		delete(p.categoryIDs, change.UUID)
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
			if p.serverWins(change, existing.UpdatedAt) {
				row, err := p.categoryByUUID(change.UUID)
				if err != nil {
					return nil, err
				}
				return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "superseded", ServerRow: row}, nil
			}
			if err := p.guarded(func() error {
				_, err := p.q.Exec(`
					UPDATE categories SET name = $1, color_hex = $2, position = COALESCE($3, position) WHERE id = $4
				`, input.Name, input.ColorHex, input.Position, existing.ID)
				return err
			}); err != nil {
				if isUniqueViolation(err) {
					return rejected(change, util.ErrCategoryExists), nil
				}
				return nil, err
			}
		} else {
			if err := p.guarded(func() error {
				// ON CONFLICT (uuid): same change already landed - idempotent success.
				_, err := p.q.Exec(`
					INSERT INTO categories (uuid, name, color_hex, owner_id, position)
					VALUES ($1, $2, $3, $4, $5)
					ON CONFLICT (uuid) DO NOTHING
				`, change.UUID, input.Name, input.ColorHex, userID, derefInt(input.Position))
				return err
			}); err != nil {
				if isUniqueViolation(err) {
					return rejected(change, util.ErrCategoryExists), nil
				}
				return nil, err
			}
		}

		row, err := p.categoryByUUID(change.UUID)
		if err != nil {
			return nil, err
		}
		return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "accepted", ServerRow: row}, nil

	default:
		return rejected(change, util.ErrInvalidSyncOp), nil
	}
}

func (p *pushRun) categoryByUUID(uuid string) (*SyncCategory, error) {
	var item SyncCategory
	var deletedAt sql.NullTime
	err := p.q.QueryRow(`
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

func (p *pushRun) pushSubTask(change SyncChange) (*SyncChangeResult, error) {
	userID := p.userID
	var existing struct {
		ID           int64         `db:"id"`
		ParentTaskID int64         `db:"parent_task_id"`
		OwnerID      sql.NullInt64 `db:"owner_id"`
		UpdatedAt    time.Time     `db:"updated_at"`
	}
	err := p.q.Get(&existing, `
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
		if p.serverWins(change, existing.UpdatedAt) {
			row, err := p.subTaskByUUID(change.UUID)
			if err != nil {
				return nil, err
			}
			return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "superseded", ServerRow: row}, nil
		}
		if _, err := p.q.Exec(`UPDATE sub_tasks SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`, existing.ID); err != nil {
			return nil, err
		}
		delete(p.subTaskIDs, change.UUID)
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
			parentTaskID, hasParent, err = p.resolveTaskID(userID, &input.ParentTaskUUID)
		} else {
			// Creating a brand-new sub-task: only allowed under a task the
			// user owns outright (see resolveOwnedTaskID) - never under a
			// global task, which only admins structurally manage.
			parentTaskID, hasParent, err = p.resolveOwnedTaskID(userID, input.ParentTaskUUID)
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
			if p.serverWins(change, existing.UpdatedAt) {
				row, err := p.subTaskByUUID(change.UUID)
				if err != nil {
					return nil, err
				}
				return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "superseded", ServerRow: row}, nil
			}
			//	description is assigned directly (not COALESCE'd like the REST
			//	ReplaceForParent update) because a sync push always carries the
			//	client's full row - a null json description here means the
			//	client cleared it, so it must reach the column as NULL.
			if _, err := p.q.Exec(`
				UPDATE sub_tasks SET title = $1, task_type = $2, target_count = $3, duration_seconds = $4,
					description = $5, position = COALESCE($6, position)
				WHERE id = $7
			`, input.Title, input.TaskType, input.TargetCount, input.DurationSeconds, input.Description, input.Position, existing.ID); err != nil {
				return nil, err
			}
		} else {
			if _, err := p.q.Exec(`
				INSERT INTO sub_tasks (uuid, parent_task_id, title, description, task_type, target_count, duration_seconds, position)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
				ON CONFLICT (uuid) DO NOTHING
			`, change.UUID, parentTaskID, input.Title, input.Description, input.TaskType, input.TargetCount, input.DurationSeconds, derefInt(input.Position)); err != nil {
				return nil, err
			}
		}

		row, err := p.subTaskByUUID(change.UUID)
		if err != nil {
			return nil, err
		}
		return &SyncChangeResult{Resource: change.Resource, UUID: change.UUID, Status: "accepted", ServerRow: row}, nil

	default:
		return rejected(change, util.ErrInvalidSyncOp), nil
	}
}

func (p *pushRun) subTaskByUUID(uuid string) (*SyncSubTask, error) {
	var item SyncSubTask
	var description sql.NullString
	var targetCount, durationSeconds sql.NullInt32
	var deletedAt sql.NullTime
	err := p.q.QueryRow(`
		SELECT st.uuid, t.uuid, st.title, st.description, st.task_type, st.target_count, st.duration_seconds,
			st.position, st.created_at, st.updated_at, st.deleted_at
		FROM sub_tasks st JOIN tasks t ON t.id = st.parent_task_id
		WHERE st.uuid = $1
	`, uuid).Scan(
		&item.UUID, &item.ParentTaskUUID, &item.Title, &description, &item.TaskType, &targetCount, &durationSeconds,
		&item.Position, &item.CreatedAt, &item.UpdatedAt, &deletedAt,
	)
	if err != nil {
		return nil, err
	}
	item.Description = nullStringPtr(description)
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

func (p *pushRun) pushTaskCompletion(change SyncChange) (*SyncChangeResult, error) {
	userID := p.userID
	var input syncCompletionInput
	if err := json.Unmarshal(change.Data, &input); err != nil {
		return rejected(change, err), nil
	}
	if reason := p.checkTaskDate(input.TaskDate); reason != nil {
		return rejected(change, reason), nil
	}
	taskID, hasTask, err := p.resolveTaskID(userID, &input.TaskUUID)
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
		err := p.q.QueryRow(`
			INSERT INTO task_completions (uuid, task_id, user_id, task_title_snapshot, was_global_snapshot, task_date, status, progress_count)
			SELECT $1, $2, $3, t.title, t.is_global, $4::date, 'pending', $5 FROM tasks t
			WHERE t.id = $2 AND t.task_type = 'counter'
				AND NOT EXISTS (SELECT 1 FROM sub_tasks s WHERE s.parent_task_id = t.id AND s.deleted_at IS NULL)
			ON CONFLICT (task_id, user_id, task_date)
			DO UPDATE SET progress_count = task_completions.progress_count + $5
			RETURNING uuid
		`, change.UUID, taskID, userID, input.TaskDate, input.Amount).Scan(&uuid)
		if errors.Is(err, sql.ErrNoRows) {
			// Not a counter (or a parent whose progress lives in its sub-tasks).
			return rejected(change, util.ErrNotCounterTask), nil
		}
		if err != nil {
			return nil, err
		}
		// Mirrors taskRepo.Increment (repo/task.go) - an increment alone never
		// flipped status past 'pending' here, so reaching (or later exceeding)
		// target_count exactly never marked the task completed; a device that
		// happened to read a pulled server row after this saw its own correct
		// local 'completed' overwritten straight back to 'pending' (see
		// reconcilePushResults in the mobile app). One-way (pending -> completed
		// only) since amount is always positive (checked above) - progress only
		// grows within a day.
		if _, err := p.q.Exec(`
			UPDATE task_completions tc SET status = 'completed', completed_at = COALESCE(tc.completed_at, now())
			FROM tasks t
			WHERE tc.uuid = $1 AND t.id = tc.task_id
				AND t.target_count IS NOT NULL AND tc.progress_count >= t.target_count
				AND tc.status <> 'completed'
		`, uuid); err != nil {
			return nil, err
		}
		row, err := p.taskCompletionByUUID(uuid)
		if err != nil {
			return nil, err
		}
		return &SyncChangeResult{Resource: change.Resource, UUID: uuid, Status: "accepted", ServerRow: row}, nil

	case "upsert":
		if input.Status == util.StatusCompleted {
			var hasSubTasks bool
			if err := p.q.Get(&hasSubTasks, `SELECT EXISTS (SELECT 1 FROM sub_tasks WHERE parent_task_id = $1 AND deleted_at IS NULL)`, taskID); err != nil {
				return nil, err
			}
			if hasSubTasks {
				return rejected(change, util.ErrTaskHasSubTasks), nil
			}
		}
		var existing struct {
			UUID      string    `db:"uuid"`
			UpdatedAt time.Time `db:"updated_at"`
		}
		err := p.q.Get(&existing, `
			SELECT uuid, updated_at FROM task_completions WHERE task_id = $1 AND user_id = $2 AND task_date = $3::date
		`, taskID, userID, input.TaskDate)
		found := true
		if err == sql.ErrNoRows {
			found = false
		} else if err != nil {
			return nil, err
		}
		if found && p.serverWins(change, existing.UpdatedAt) {
			row, err := p.taskCompletionByUUID(existing.UUID)
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
		err = p.q.QueryRow(`
			INSERT INTO task_completions (uuid, task_id, user_id, task_title_snapshot, was_global_snapshot, task_date, status, completed_at)
			SELECT $1, $2, $3, t.title, t.is_global, $4::date, $5, $6 FROM tasks t WHERE t.id = $2
			ON CONFLICT (task_id, user_id, task_date)
			DO UPDATE SET status = $5, completed_at = $6
			RETURNING uuid
		`, change.UUID, taskID, userID, input.TaskDate, input.Status, completedAt).Scan(&uuid)
		if err != nil {
			return nil, err
		}
		row, err := p.taskCompletionByUUID(uuid)
		if err != nil {
			return nil, err
		}
		return &SyncChangeResult{Resource: change.Resource, UUID: uuid, Status: "accepted", ServerRow: row}, nil

	default:
		return rejected(change, util.ErrInvalidSyncOp), nil
	}
}

func (p *pushRun) taskCompletionByUUID(uuid string) (*SyncTaskCompletion, error) {
	var item SyncTaskCompletion
	var taskUUID sql.NullString
	var taskDate time.Time
	var completedAt, deletedAt sql.NullTime
	err := p.q.QueryRow(`
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

func (p *pushRun) pushSubTaskCompletion(change SyncChange) (*SyncChangeResult, error) {
	userID := p.userID
	var input syncCompletionInput
	if err := json.Unmarshal(change.Data, &input); err != nil {
		return rejected(change, err), nil
	}
	if reason := p.checkTaskDate(input.TaskDate); reason != nil {
		return rejected(change, reason), nil
	}
	subTaskID, hasSubTask, err := p.resolveSubTaskID(userID, &input.SubTaskUUID)
	if err != nil {
		return nil, err
	}
	if !hasSubTask {
		return rejected(change, util.ErrSyncParentNotFound), nil
	}
	parentTaskID, hasParent, err := p.resolveTaskID(userID, &input.ParentTaskUUID)
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
		err := p.q.QueryRow(`
			INSERT INTO sub_task_completions (uuid, sub_task_id, parent_task_id, user_id, sub_task_title_snapshot, task_date, status, progress_count)
			SELECT $1, $2, $3, $4, st.title, $5::date, 'pending', $6 FROM sub_tasks st
			WHERE st.id = $2 AND st.task_type = 'counter'
			ON CONFLICT (sub_task_id, user_id, task_date)
			DO UPDATE SET progress_count = sub_task_completions.progress_count + $6
			RETURNING uuid
		`, change.UUID, subTaskID, parentTaskID, userID, input.TaskDate, input.Amount).Scan(&uuid)
		if errors.Is(err, sql.ErrNoRows) {
			// Not a counter (or a parent whose progress lives in its sub-tasks).
			return rejected(change, util.ErrNotCounterTask), nil
		}
		if err != nil {
			return nil, err
		}
		// See pushTaskCompletion's identical fix above - an increment alone
		// never flipped status past 'pending', so a counter sub-task never
		// actually reached 'completed' (which in turn kept its parent from
		// ever reaching 'completed' too, since that's derived from every
		// sub-task's status).
		if _, err := p.q.Exec(`
			UPDATE sub_task_completions stc SET status = 'completed', completed_at = COALESCE(stc.completed_at, now())
			FROM sub_tasks st
			WHERE stc.uuid = $1 AND st.id = stc.sub_task_id
				AND st.target_count IS NOT NULL AND stc.progress_count >= st.target_count
				AND stc.status <> 'completed'
		`, uuid); err != nil {
			return nil, err
		}
		row, err := p.subTaskCompletionByUUID(uuid)
		if err != nil {
			return nil, err
		}
		return &SyncChangeResult{Resource: change.Resource, UUID: uuid, Status: "accepted", ServerRow: row}, nil

	case "upsert":
		var existing struct {
			UUID      string    `db:"uuid"`
			UpdatedAt time.Time `db:"updated_at"`
		}
		err := p.q.Get(&existing, `
			SELECT uuid, updated_at FROM sub_task_completions WHERE sub_task_id = $1 AND user_id = $2 AND task_date = $3::date
		`, subTaskID, userID, input.TaskDate)
		found := true
		if err == sql.ErrNoRows {
			found = false
		} else if err != nil {
			return nil, err
		}
		if found && p.serverWins(change, existing.UpdatedAt) {
			row, err := p.subTaskCompletionByUUID(existing.UUID)
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
		err = p.q.QueryRow(`
			INSERT INTO sub_task_completions (uuid, sub_task_id, parent_task_id, user_id, sub_task_title_snapshot, task_date, status, completed_at)
			SELECT $1, $2, $3, $4, st.title, $5::date, $6, $7 FROM sub_tasks st WHERE st.id = $2
			ON CONFLICT (sub_task_id, user_id, task_date)
			DO UPDATE SET status = $6, completed_at = $7
			RETURNING uuid
		`, change.UUID, subTaskID, parentTaskID, userID, input.TaskDate, input.Status, completedAt).Scan(&uuid)
		if err != nil {
			return nil, err
		}
		row, err := p.subTaskCompletionByUUID(uuid)
		if err != nil {
			return nil, err
		}
		return &SyncChangeResult{Resource: change.Resource, UUID: uuid, Status: "accepted", ServerRow: row}, nil

	default:
		return rejected(change, util.ErrInvalidSyncOp), nil
	}
}

func (p *pushRun) subTaskCompletionByUUID(uuid string) (*SyncSubTaskCompletion, error) {
	var item SyncSubTaskCompletion
	var subTaskUUID sql.NullString
	var taskDate time.Time
	var completedAt, deletedAt sql.NullTime
	err := p.q.QueryRow(`
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
