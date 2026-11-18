package repo

import (
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

// AdminOverview is the admin dashboard's real data (F8 / B11), replacing the
// numbers the web admin page used to derive from the ADMIN's own history.
type AdminOverview struct {
	TotalUsers  int `db:"total_users"`
	NewUsers    int `db:"new_users"`
	ActiveToday int `db:"active_today"`
	// ActiveUsers: distinct users who recorded any progress in the window.
	ActiveUsers int `db:"active_users"`
	Tasks       []AdminTaskUsage
}

// AdminTaskUsage is one global (fixed) task's usage in the window.
type AdminTaskUsage struct {
	UUID           string        `db:"uuid"`
	Title          string        `db:"title"`
	RecurrenceDays pq.Int64Array `db:"recurrence_days"`
	// Completions: user-days the task was completed (for a task with
	// sub-tasks: user-days on which every live sub-task was completed).
	Completions int `db:"completions"`
	// Users: distinct users with at least one completion.
	Users int `db:"users"`
	// AddedBy: live personal copies made with "add to my tasks".
	AddedBy int `db:"added_by"`
}

type AdminStatsRepo interface {
	Overview(from, to time.Time) (*AdminOverview, error)
}

type adminStatsRepo struct {
	db *sqlx.DB
}

func NewAdminStatsRepo(db *sqlx.DB) AdminStatsRepo {
	return &adminStatsRepo{db: db}
}

const adminOverviewQuery = `
	WITH activity AS (
		SELECT user_id, task_date FROM task_completions
		WHERE task_date BETWEEN $1::date AND $2::date AND deleted_at IS NULL
		UNION
		SELECT user_id, task_date FROM sub_task_completions
		WHERE task_date BETWEEN $1::date AND $2::date AND deleted_at IS NULL
	)
	SELECT
		(SELECT count(*) FROM users)                                              AS total_users,
		(SELECT count(*) FROM users WHERE created_at >= $1::date)                 AS new_users,
		(SELECT count(DISTINCT user_id) FROM activity WHERE task_date = $2::date) AS active_today,
		(SELECT count(DISTINCT user_id) FROM activity)                            AS active_users
`

const adminTaskUsageQuery = `
	SELECT
		t.uuid::text AS uuid, t.title, t.recurrence_days,
		COALESCE(c.completions, 0) + COALESCE(sc.completions, 0) AS completions,
		GREATEST(COALESCE(c.users, 0), COALESCE(sc.users, 0))   AS users,
		COALESCE(a.added_by, 0)                                  AS added_by
	FROM tasks t
	LEFT JOIN (
		SELECT task_id, count(*) AS completions, count(DISTINCT user_id) AS users
		FROM task_completions
		WHERE task_date BETWEEN $1::date AND $2::date AND deleted_at IS NULL AND status = 'completed'
		GROUP BY task_id
	) c ON c.task_id = t.id
	LEFT JOIN (
		SELECT parent_task_id, count(*) AS completions, count(DISTINCT user_id) AS users
		FROM (
			SELECT stc.parent_task_id, stc.user_id, stc.task_date
			FROM sub_task_completions stc
			WHERE stc.task_date BETWEEN $1::date AND $2::date AND stc.deleted_at IS NULL AND stc.status = 'completed'
			GROUP BY stc.parent_task_id, stc.user_id, stc.task_date
			HAVING count(*) >= (
				SELECT count(*) FROM sub_tasks s WHERE s.parent_task_id = stc.parent_task_id AND s.deleted_at IS NULL
			)
		) full_days
		GROUP BY parent_task_id
	) sc ON sc.parent_task_id = t.id
	LEFT JOIN (
		SELECT source_task_id, count(*) AS added_by
		FROM tasks
		WHERE source_task_id IS NOT NULL AND deleted_at IS NULL AND NOT is_global
		GROUP BY source_task_id
	) a ON a.source_task_id = t.id
	WHERE t.is_global AND t.deleted_at IS NULL
	ORDER BY t.position, t.id
`

func (r *adminStatsRepo) Overview(from, to time.Time) (*AdminOverview, error) {
	fromStr, toStr := from.Format("2006-01-02"), to.Format("2006-01-02")

	var o AdminOverview
	if err := r.db.Get(&o, adminOverviewQuery, fromStr, toStr); err != nil {
		return nil, err
	}
	if err := r.db.Select(&o.Tasks, adminTaskUsageQuery, fromStr, toStr); err != nil {
		return nil, err
	}
	return &o, nil
}
