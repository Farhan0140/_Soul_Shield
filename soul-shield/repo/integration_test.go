package repo

// Database-backed tests. They run only when TEST_DATABASE_URL points at a
// DISPOSABLE Postgres database (CI starts one - see .github/workflows/ci.yml);
// every test wipes all data first. Never point this at a real database.
//
//   TEST_DATABASE_URL=postgres://test:test@localhost:5432/soulshield_test?sslmode=disable go test ./repo/

import (
	"encoding/json"
	"errors"
	"os"
	"soulsheld/util"
	"testing"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/jmoiron/sqlx"
	migrate "github.com/rubenv/sql-migrate"
)

func testDB(t *testing.T) *sqlx.DB {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping database test")
	}
	db, err := sqlx.Connect("pgx", url)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	if _, err := migrate.Exec(db.DB, "postgres", &migrate.FileMigrationSource{Dir: "../migrations"}, migrate.Up); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if _, err := db.Exec(`TRUNCATE users, email_otps, security_answer_attempt_logs RESTART IDENTITY CASCADE`); err != nil {
		t.Fatalf("truncate: %v", err)
	}
	return db
}

func mkUser(t *testing.T, db *sqlx.DB, email string) *User {
	t.Helper()
	u, err := NewUserRepo(db).Create(User{Full_Name: "Test", Email: email, Password: "secret123", SecurityAnswer: "blue bird"})
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	return u
}

func mkTask(t *testing.T, db *sqlx.DB, ownerID int64, title, taskType string) *Task {
	t.Helper()
	task := Task{
		Title: title, OwnerID: nullInt64(ownerID, true), CreatedBy: ownerID,
		RecurrenceType: util.RecurrenceDaily, TaskType: taskType,
	}
	if taskType == "counter" {
		task.TargetCount.Int32, task.TargetCount.Valid = 3, true
	}
	created, err := NewTaskRepo(db).Create(task)
	if err != nil {
		t.Fatalf("create task: %v", err)
	}
	return created
}

func change(resource, op, uuid string, clientAt time.Time, data any) SyncChange {
	raw, _ := json.Marshal(data)
	return SyncChange{Resource: resource, Op: op, UUID: uuid, ClientUpdatedAt: clientAt, Data: raw}
}

const (
	catUUID   = "11111111-1111-4111-8111-111111111111"
	taskUUID  = "22222222-2222-4222-8222-222222222222"
	badUUID   = "33333333-3333-4333-8333-333333333333"
	compUUID  = "44444444-4444-4444-8444-444444444444"
	comp2UUID = "55555555-5555-4555-8555-555555555555"
)

func statuses(results []SyncChangeResult) []string {
	out := make([]string, len(results))
	for i, r := range results {
		out[i] = r.Status
	}
	return out
}

func TestPushChangesIsolatesARejectedChange(t *testing.T) {
	db := testDB(t)
	u := mkUser(t, db, "push@example.com")
	repo := NewSyncRepo(db)
	now := time.Now()
	today := util.TodayIn(time.UTC)

	results, err := repo.PushChanges(u.ID, []SyncChange{
		change("categories", "upsert", catUUID, now, map[string]any{"name": "Prayer", "color_hex": "#112233"}),
		change("tasks", "upsert", taskUUID, now, map[string]any{
			"title": "Fajr", "recurrence_type": "daily", "recurrence_days": []int{0, 1, 2, 3, 4, 5, 6},
			"task_type": "normal", "category_uuid": catUUID,
		}),
		// Violates CHECK (length(title) > 0): must be rejected on its own.
		change("tasks", "upsert", badUUID, now, map[string]any{
			"title": "", "recurrence_type": "daily", "recurrence_days": []int{1}, "task_type": "normal",
		}),
		change("task_completions", "upsert", compUUID, now, map[string]any{
			"task_uuid": taskUUID, "task_date": today.Format(util.DateLayout), "status": "completed",
		}),
	}, today)
	if err != nil {
		t.Fatalf("push: %v", err)
	}
	want := []string{"accepted", "accepted", "rejected", "accepted"}
	for i, s := range statuses(results) {
		if s != want[i] {
			t.Fatalf("statuses = %v, want %v (%+v)", statuses(results), want, results)
		}
	}

	var tasks, completions int
	db.Get(&tasks, `SELECT count(*) FROM tasks WHERE owner_id = $1`, u.ID)
	db.Get(&completions, `SELECT count(*) FROM task_completions WHERE user_id = $1 AND status = 'completed'`, u.ID)
	if tasks != 1 || completions != 1 {
		t.Fatalf("tasks=%d completions=%d, want 1 and 1", tasks, completions)
	}
}

func TestPushChangesDuplicateCategoryNameIsRejectedNotFatal(t *testing.T) {
	db := testDB(t)
	u := mkUser(t, db, "cat@example.com")
	repo := NewSyncRepo(db)
	now := time.Now()

	results, err := repo.PushChanges(u.ID, []SyncChange{
		change("categories", "upsert", catUUID, now, map[string]any{"name": "Quran"}),
		change("categories", "upsert", badUUID, now, map[string]any{"name": "Quran"}),
		change("tasks", "upsert", taskUUID, now, map[string]any{
			"title": "Read", "recurrence_type": "daily", "recurrence_days": []int{0, 1, 2, 3, 4, 5, 6}, "task_type": "normal",
		}),
	}, util.TodayIn(time.UTC))
	if err != nil {
		t.Fatalf("push: %v", err)
	}
	if got := statuses(results); got[0] != "accepted" || got[1] != "rejected" || got[2] != "accepted" {
		t.Fatalf("statuses = %v", got)
	}
}

func TestPushChangesIsIdempotentOnReplay(t *testing.T) {
	db := testDB(t)
	u := mkUser(t, db, "replay@example.com")
	repo := NewSyncRepo(db)
	batch := []SyncChange{change("tasks", "upsert", taskUUID, time.Now(), map[string]any{
		"title": "Dhikr", "recurrence_type": "daily", "recurrence_days": []int{0, 1, 2, 3, 4, 5, 6}, "task_type": "normal",
	})}
	results, err := repo.PushChanges(u.ID, batch, util.TodayIn(time.UTC))
	if err != nil || results[0].Status != "accepted" {
		t.Fatalf("first push: %v %+v", err, results)
	}

	// The replay (a retry after a lost response) carries the same
	// client_updated_at, which is now older than the row's server-set
	// updated_at, so last-write-wins may answer "superseded" - with the
	// server row, which is exactly what was pushed. Either answer is
	// correct; what idempotency requires is no error and no duplicate row.
	results, err = repo.PushChanges(u.ID, batch, util.TodayIn(time.UTC))
	if err != nil {
		t.Fatalf("replay: %v", err)
	}
	switch r := results[0]; r.Status {
	case "accepted":
	case "superseded":
		row, ok := r.ServerRow.(*SyncTask)
		if !ok || row == nil || row.Title != "Dhikr" {
			t.Fatalf("replay superseded with unexpected server row: %+v", r.ServerRow)
		}
	default:
		t.Fatalf("replay: %+v", r)
	}
	var n int
	db.Get(&n, `SELECT count(*) FROM tasks WHERE uuid = $1`, taskUUID)
	if n != 1 {
		t.Fatalf("rows = %d, want 1", n)
	}
}

func TestPushChangesBusinessRules(t *testing.T) {
	db := testDB(t)
	u := mkUser(t, db, "rules@example.com")
	normal := mkTask(t, db, u.ID, "Normal", "normal")
	counter := mkTask(t, db, u.ID, "Counter", "counter")
	repo := NewSyncRepo(db)
	today := util.TodayIn(time.UTC)
	tomorrow := today.AddDate(0, 0, 1).Format(util.DateLayout)

	results, err := repo.PushChanges(u.ID, []SyncChange{
		// Future date: rejected.
		change("task_completions", "upsert", compUUID, time.Now(), map[string]any{
			"task_uuid": normal.UUID, "task_date": tomorrow, "status": "completed",
		}),
		// Increment on a non-counter task: rejected.
		change("task_completions", "increment", comp2UUID, time.Now(), map[string]any{
			"task_uuid": normal.UUID, "task_date": today.Format(util.DateLayout), "amount": 1,
		}),
		// Increment on a counter reaching its target: accepted and completed.
		change("task_completions", "increment", badUUID, time.Now(), map[string]any{
			"task_uuid": counter.UUID, "task_date": today.Format(util.DateLayout), "amount": 3,
		}),
	}, today)
	if err != nil {
		t.Fatalf("push: %v", err)
	}
	if got := statuses(results); got[0] != "rejected" || got[1] != "rejected" || got[2] != "accepted" {
		t.Fatalf("statuses = %v (%+v)", got, results)
	}
	if row, ok := results[2].ServerRow.(*SyncTaskCompletion); !ok || row.Status != util.StatusCompleted {
		t.Fatalf("counter row = %+v, want completed", results[2].ServerRow)
	}
}

func TestPushChangesConflictUsesBaseUpdatedAt(t *testing.T) {
	db := testDB(t)
	u := mkUser(t, db, "conflict@example.com")
	task := mkTask(t, db, u.ID, "Original", "normal")
	repo := NewSyncRepo(db)
	edit := func(title string, clientAt time.Time, base *time.Time) SyncChangeResult {
		c := change("tasks", "upsert", task.UUID, clientAt, map[string]any{
			"title": title, "recurrence_type": "daily", "recurrence_days": []int{0, 1, 2, 3, 4, 5, 6}, "task_type": "normal",
		})
		c.BaseUpdatedAt = base
		results, err := repo.PushChanges(u.ID, []SyncChange{c}, util.TodayIn(time.UTC))
		if err != nil {
			t.Fatalf("push: %v", err)
		}
		return results[0]
	}
	serverUpdatedAt := func() time.Time {
		var at time.Time
		db.Get(&at, `SELECT updated_at FROM tasks WHERE id = $1`, task.ID)
		return at
	}

	// A phone whose clock is a day BEHIND, but which saw the current server
	// row: its edit applies (no real conflict), whatever the clocks say.
	base := serverUpdatedAt()
	if r := edit("From slow phone", time.Now().Add(-24*time.Hour), &base); r.Status != "accepted" {
		t.Fatalf("edit with matching base: %s, want accepted", r.Status)
	}

	// A stale base (the server row changed since): real conflict, decided by
	// timestamp - a client time far in the FUTURE is capped at server time,
	// so it can't automatically win... but it still wins against an older
	// server row, which is the expected last-write-wins outcome.
	stale := base.Add(-time.Hour)
	if r := edit("From fast phone", time.Now().Add(365*24*time.Hour), &stale); r.Status != "accepted" {
		t.Fatalf("conflict with older server row: %s, want accepted", r.Status)
	}

	// Without a base, a client time older than the server row loses.
	if r := edit("Old offline edit", time.Now().Add(-time.Hour), nil); r.Status != "superseded" {
		t.Fatalf("old edit without base: %s, want superseded", r.Status)
	}
}

func TestResetPasswordIsSingleUseAndRevokesSessions(t *testing.T) {
	db := testDB(t)
	users := NewUserRepo(db)
	u := mkUser(t, db, "reset@example.com")

	version, err := users.VerifySecurityAnswer("reset@example.com", "blue bird", "203.0.113.1")
	if err != nil || version != 0 {
		t.Fatalf("verify: version %d err %v", version, err)
	}
	if err := users.ResetPassword("reset@example.com", version, "new-secret-1"); err != nil {
		t.Fatalf("first reset: %v", err)
	}
	if err := users.ResetPassword("reset@example.com", version, "another-one"); !errors.Is(err, util.ErrInvalidResetToken) {
		t.Fatalf("replayed reset: %v, want ErrInvalidResetToken", err)
	}
	if _, v, _ := users.SessionState(u.ID); v != 1 {
		t.Fatalf("token_version = %d, want 1", v)
	}
	if _, err := users.Find("reset@example.com", "new-secret-1"); err != nil {
		t.Fatalf("login with the new password: %v", err)
	}

	updated, err := users.ChangePassword(u.ID, "new-secret-1", "third-pass")
	if err != nil || updated.TokenVersion != 2 {
		t.Fatalf("change password: %+v %v", updated, err)
	}
	if _, err := users.ChangePassword(u.ID, "wrong", "x-pass-123"); !errors.Is(err, util.ErrCurrentPasswordIncorrect) {
		t.Fatalf("wrong current password: %v", err)
	}
}

func TestUpdateWithSubTasksIsAtomic(t *testing.T) {
	db := testDB(t)
	u := mkUser(t, db, "atomic@example.com")
	task := mkTask(t, db, u.ID, "Before", "normal")
	tasks := NewTaskRepo(db)

	title := "After"
	_, _, err := tasks.UpdateWithSubTasks(task.ID, TaskUpdate{Title: &title}, u.ID, "user", []SubTask{
		{ID: 999999, Title: "Does not exist", TaskType: "normal"},
	})
	if !errors.Is(err, util.ErrSubTaskNotFound) {
		t.Fatalf("err = %v, want ErrSubTaskNotFound", err)
	}
	reloaded, _ := tasks.GetByID(task.ID)
	if reloaded.Title != "Before" {
		t.Fatalf("title = %q: the task was half-updated", reloaded.Title)
	}

	updated, subs, err := tasks.UpdateWithSubTasks(task.ID, TaskUpdate{Title: &title}, u.ID, "user", []SubTask{
		{Title: "Step 1", TaskType: "normal"},
	})
	if err != nil || updated.Title != "After" || len(subs) != 1 {
		t.Fatalf("valid update: %+v %v %v", updated, subs, err)
	}
}

func TestCompleteRulesAndUncomplete(t *testing.T) {
	db := testDB(t)
	u := mkUser(t, db, "complete@example.com")
	tasks := NewTaskRepo(db)
	today := util.TodayIn(time.UTC)

	task := mkTask(t, db, u.ID, "Pray", "normal")
	if _, err := tasks.Complete(task.ID, u.ID, today); err != nil {
		t.Fatalf("complete: %v", err)
	}
	c, err := tasks.Uncomplete(task.ID, u.ID, today)
	if err != nil || c.Status != util.StatusPending || c.CompletedAt.Valid {
		t.Fatalf("uncomplete: %+v %v", c, err)
	}
	if c, err := tasks.Uncomplete(task.ID, u.ID, today.AddDate(0, 0, -3)); err != nil || c.Status != util.StatusPending {
		t.Fatalf("uncomplete with no row should be a no-op: %+v %v", c, err)
	}

	parent, _, err := tasks.CreateWithSubTasks(Task{
		Title: "Parent", OwnerID: nullInt64(u.ID, true), CreatedBy: u.ID, RecurrenceType: util.RecurrenceDaily, TaskType: "normal",
	}, []SubTask{{Title: "Child", TaskType: "normal"}})
	if err != nil {
		t.Fatalf("create parent: %v", err)
	}
	if _, err := tasks.Complete(parent.ID, u.ID, today); !errors.Is(err, util.ErrTaskHasSubTasks) {
		t.Fatalf("completing a parent directly: %v, want ErrTaskHasSubTasks", err)
	}
}

func TestAdminOverviewQueries(t *testing.T) {
	db := testDB(t)
	u := mkUser(t, db, "stats@example.com")
	mkTask(t, db, u.ID, "Personal", "normal")
	today := util.TodayIn(time.UTC)

	o, err := NewAdminStatsRepo(db).Overview(today.AddDate(0, 0, -29), today)
	if err != nil {
		t.Fatalf("overview: %v", err)
	}
	if o.TotalUsers != 1 || o.NewUsers != 1 {
		t.Fatalf("users = %d new = %d", o.TotalUsers, o.NewUsers)
	}
}

func TestPullCursorQueryRuns(t *testing.T) {
	db := testDB(t)
	u := mkUser(t, db, "pull@example.com")
	snap, err := NewSyncRepo(db).PullChanges(u.ID, time.Time{})
	if err != nil {
		t.Fatalf("pull: %v", err)
	}
	if snap.Cursor.IsZero() || snap.Cursor.After(time.Now().Add(time.Minute)) {
		t.Fatalf("cursor = %v", snap.Cursor)
	}
}

func TestSecurityAnswerLockoutIsPerIP(t *testing.T) {
	db := testDB(t)
	users := NewUserRepo(db)
	mkUser(t, db, "lock@example.com")

	const attacker, owner = "198.51.100.1", "203.0.113.9"
	var err error
	for i := 0; i < maxSecurityAnswerAttempts; i++ {
		_, err = users.VerifySecurityAnswer("lock@example.com", "wrong guess", attacker)
	}
	if !errors.Is(err, util.ErrSecurityAnswerLocked) {
		t.Fatalf("5th failure from one IP: %v, want locked", err)
	}
	if _, err := users.VerifySecurityAnswer("lock@example.com", "blue bird", attacker); !errors.Is(err, util.ErrSecurityAnswerLocked) {
		t.Fatalf("locked IP with the right answer: %v, want still locked", err)
	}
	// The real owner, from another IP, is not locked out by the stranger.
	if _, err := users.VerifySecurityAnswer("lock@example.com", "blue bird", owner); err != nil {
		t.Fatalf("owner from another IP: %v, want success", err)
	}
}

func TestCategoryRenameToExistingNameIsConflict(t *testing.T) {
	db := testDB(t)
	u := mkUser(t, db, "rename@example.com")
	cats := NewCategoryRepo(db)
	if _, err := cats.Create(Category{Name: "Quran", ColorHex: "#112233", OwnerID: u.ID}); err != nil {
		t.Fatal(err)
	}
	other, err := cats.Create(Category{Name: "Dhikr", ColorHex: "#112233", OwnerID: u.ID})
	if err != nil {
		t.Fatal(err)
	}
	name := "Quran"
	if _, err := cats.Update(other.ID, CategoryUpdate{Name: &name}, u.ID); !errors.Is(err, util.ErrCategoryExists) {
		t.Fatalf("rename onto an existing name: %v, want ErrCategoryExists", err)
	}
}

// The public pull must hand out fixed tasks (with their sub-tasks and
// category) and never anyone's personal rows.
func TestPullGlobalChangesReturnsOnlyFixedTasks(t *testing.T) {
	db := testDB(t)
	admin := mkUser(t, db, "admin-global@example.com")
	user := mkUser(t, db, "user-global@example.com")

	cat, err := NewCategoryRepo(db).Create(Category{Name: "Morning", ColorHex: "#336699", OwnerID: admin.ID})
	if err != nil {
		t.Fatalf("create category: %v", err)
	}
	global, err := NewTaskRepo(db).Create(Task{
		Title: "Fixed dhikr", IsGlobal: true, CreatedBy: admin.ID,
		CategoryID: nullInt64(cat.ID, true), RecurrenceType: util.RecurrenceDaily, TaskType: "normal",
	})
	if err != nil {
		t.Fatalf("create global task: %v", err)
	}
	if _, err := NewSubTaskRepo(db).ReplaceForParent(global.ID, []SubTask{{Title: "Step one", TaskType: "normal"}}); err != nil {
		t.Fatalf("create sub-task: %v", err)
	}
	personal := mkTask(t, db, user.ID, "My own task", "normal")

	snap, err := NewSyncRepo(db).PullGlobalChanges(time.Time{})
	if err != nil {
		t.Fatalf("PullGlobalChanges: %v", err)
	}

	if len(snap.Tasks) != 1 || snap.Tasks[0].UUID != global.UUID || !snap.Tasks[0].IsGlobal {
		t.Fatalf("tasks = %+v, want only the fixed task", snap.Tasks)
	}
	for _, task := range snap.Tasks {
		if task.UUID == personal.UUID {
			t.Fatal("public pull leaked a personal task")
		}
	}
	if len(snap.SubTasks) != 1 || snap.SubTasks[0].ParentTaskUUID != global.UUID {
		t.Errorf("sub_tasks = %+v, want the fixed task's one sub-task", snap.SubTasks)
	}
	if len(snap.GlobalCategories) != 1 || snap.GlobalCategories[0].Name != "Morning" {
		t.Errorf("global_categories = %+v, want [Morning]", snap.GlobalCategories)
	}

	// A delta pull from the returned cursor has nothing new.
	again, err := NewSyncRepo(db).PullGlobalChanges(snap.Cursor)
	if err != nil {
		t.Fatalf("delta PullGlobalChanges: %v", err)
	}
	if len(again.Tasks) != 0 || len(again.SubTasks) != 0 {
		t.Errorf("delta pull returned %d tasks / %d sub-tasks, want none", len(again.Tasks), len(again.SubTasks))
	}
	if len(again.GlobalCategories) != 1 {
		t.Errorf("delta pull global_categories = %d, want the full set (1)", len(again.GlobalCategories))
	}
}

func TestFeedbackOneVotePerPersonAndGuestNames(t *testing.T) {
	db := testDB(t)
	if _, err := db.Exec(`TRUNCATE guest_devices RESTART IDENTITY CASCADE`); err != nil {
		t.Fatalf("truncate: %v", err)
	}
	r := NewFeedbackRepo(db)
	u := mkUser(t, db, "rater@example.com")

	g1, err := r.GuestDeviceID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
	if err != nil {
		t.Fatalf("guest: %v", err)
	}
	again, _ := r.GuestDeviceID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
	g2, _ := r.GuestDeviceID("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
	if g1 != 1 || again != 1 || g2 != 2 {
		t.Fatalf("guest numbers %d %d %d, want 1 1 2", g1, again, g2)
	}

	msg := "Please add more widgets"
	for _, f := range []NewFeedback{
		{UserID: &u.ID, Rating: 2},
		{UserID: &u.ID, Rating: 5, Message: &msg}, // replaces this user's 2
		{GuestDeviceID: &g1, Rating: 4},
		{GuestDeviceID: &g2, Rating: 4},
	} {
		if _, err := r.Create(f); err != nil {
			t.Fatalf("create: %v", err)
		}
	}

	s, err := r.Summary()
	if err != nil {
		t.Fatalf("summary: %v", err)
	}
	if s.Total != 3 || s.Counts["5"] != 1 || s.Counts["4"] != 2 || s.Counts["2"] != 0 {
		t.Fatalf("summary %+v", s)
	}

	items, err := r.List(10, 0)
	if err != nil || len(items) != 4 {
		t.Fatalf("list: %v (%d items)", err, len(items))
	}
	if items[0].Submitter != "guest-user-2" || !items[0].IsGuest || items[3].Submitter != "Test" || items[3].Email == nil {
		t.Fatalf("submitters: %q %q", items[0].Submitter, items[3].Submitter)
	}
	if n, _ := r.UnreadCount(); n != 4 {
		t.Fatalf("unread %d", n)
	}
	if err := r.MarkAllRead(); err != nil {
		t.Fatal(err)
	}
	if n, _ := r.UnreadCount(); n != 0 {
		t.Fatalf("unread after mark %d", n)
	}

	// A guest-only row must not violate the one-submitter CHECK; neither-set must.
	if _, err := r.Create(NewFeedback{Rating: 3}); err == nil {
		t.Fatal("feedback without a submitter was accepted")
	}
}
