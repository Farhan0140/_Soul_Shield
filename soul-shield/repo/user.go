package repo

import (
	"database/sql"
	"errors"
	"log/slog"
	"soulsheld/util"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"golang.org/x/crypto/bcrypt"
)

const (
	// S10b: failures are counted per email AND caller IP, so a stranger
	// guessing 5 times locks out only their own IP, not the account owner.
	// A higher per-email ceiling (all IPs together) still caps brute force
	// spread over many addresses. Counts cover the last
	// securityAnswerLockDuration, reset by a successful answer.
	maxSecurityAnswerAttempts         = 5
	maxSecurityAnswerAttemptsPerEmail = 20
	securityAnswerLockDuration        = 24 * time.Hour
)

type UserRepo interface {
	Create(user User) (*User, error)
	Find(email, password string) (*User, error)
	GetByID(id int64) (*User, error)
	// SessionState is the live role + token_version AuthenticateJWT checks
	// every session token against. ErrUserNotFound if the account is gone.
	SessionState(userID int64) (role string, tokenVersion int, err error)
	// ResetPassword stores newPassword for email, but only if the account's
	// token_version still equals expectedVersion (the version baked into the
	// reset token). It bumps the version, so the reset token is single-use and
	// every existing session is signed out. ErrInvalidResetToken otherwise.
	ResetPassword(email string, expectedVersion int, newPassword string) error
	// VerifySecurityAnswer returns the account's current token_version on
	// success (embedded in the reset token).
	VerifySecurityAnswer(email, answer, ipAddress string) (tokenVersion int, err error)
	// ChangePassword re-verifies currentPassword before storing newPassword,
	// bumps token_version (signing out every other device) and returns the
	// updated user so the caller can issue the current device a new token.
	ChangePassword(userID int64, currentPassword, newPassword string) (*User, error)
	// DeleteAccount re-verifies password, then permanently deletes the user
	// and (via ON DELETE CASCADE) everything they own.
	DeleteAccount(userID int64, password string) error
}

type userRepo struct {
	db *sqlx.DB
}

func NewUserRepo(db *sqlx.DB) UserRepo {
	return &userRepo{
		db: db,
	}
}

// normalizeEmail is the one canonical form an email is stored and looked up
// in (trimmed, lowercase) - the users table enforces it with a CHECK
// constraint (see migrations/000001_init_schema.sql). Without it,
// "Farhan@x.com" typed on a phone keyboard that auto-capitalizes and
// "farhan@x.com" typed on the website were two different accounts, and
// password reset (which already lowercased) couldn't find either.
func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func (r *userRepo) Create(user User) (*User, error) {
	user.Email = normalizeEmail(user.Email)
	tx, err := r.db.Beginx()
	if err != nil {
		return nil, err
	}

	defer tx.Rollback()

	hashedPassword, err := bcrypt.GenerateFromPassword(
		[]byte(user.Password),
		bcrypt.DefaultCost,
	)
	if err != nil {
		return nil, err
	}
	user.Password = string(hashedPassword)

	hashedAnswer, err := bcrypt.GenerateFromPassword(
		[]byte(user.SecurityAnswer),
		bcrypt.DefaultCost,
	)
	if err != nil {
		return nil, err
	}

	query := `
		INSERT INTO users (
			full_name,
			email,
			password,
			security_answer_hash
		) VALUES (
			$1,
			$2,
			$3,
			$4
		)
		RETURNING id
	`

	row := tx.QueryRow(query, user.Full_Name, user.Email, user.Password, string(hashedAnswer))
	err = row.Scan(&user.ID)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, util.ErrUserExists
		}
		return nil, err
	}

	_, err = tx.Exec(`
		UPDATE email_otps
		SET verified=false
		WHERE email=$1
	`,
		user.Email,
	)

	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *userRepo) Find(email, password string) (*User, error) {
	email = normalizeEmail(email)
	var user User
	query := `
		SELECT id, full_name, email, password, role, token_version
		FROM users
		WHERE email = $1
		LIMIT 1
	`
	err := r.db.Get(&user, query, email)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, util.ErrUserNotFound
		}
		return nil, err
	}

	err = bcrypt.CompareHashAndPassword(
		[]byte(user.Password),
		[]byte(password),
	)
	if err != nil {
		// Wrong password (or a corrupted hash). Returning a sentinel instead of
		// (nil, nil) lets the handler answer 401 "Incorrect email or password"
		// instead of the misleading 400 "Internal Server Error" it used to send.
		return nil, util.ErrInvalidCredentials
	}

	return &user, nil
}

func (r *userRepo) GetByID(id int64) (*User, error) {
	var user User
	query := `
		SELECT id, full_name, email, role, created_at
		FROM users
		WHERE id = $1
		LIMIT 1
	`
	err := r.db.Get(&user, query, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, util.ErrUserNotFound
		}
		return nil, err
	}

	return &user, nil
}

func (r *userRepo) SessionState(userID int64) (string, int, error) {
	var row struct {
		Role         string `db:"role"`
		TokenVersion int    `db:"token_version"`
	}
	err := r.db.Get(&row, `SELECT role, token_version FROM users WHERE id = $1`, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", 0, util.ErrUserNotFound
		}
		return "", 0, err
	}
	return row.Role, row.TokenVersion, nil
}

func (r *userRepo) ResetPassword(email string, expectedVersion int, newPassword string) error {
	email = normalizeEmail(email)

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	tx, err := r.db.Beginx()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// The token_version guard makes the reset token single-use: the first
	// successful reset bumps the version, so a replay matches no row.
	result, err := tx.Exec(`
		UPDATE users
		SET password = $1, token_version = token_version + 1
		WHERE email = $2 AND token_version = $3
	`, string(hashedPassword), email, expectedVersion)
	if err != nil {
		return err
	}
	if n, _ := result.RowsAffected(); n == 0 {
		return util.ErrInvalidResetToken
	}

	if _, err := tx.Exec(`UPDATE email_otps SET verified = false WHERE email = $1`, email); err != nil {
		return err
	}

	return tx.Commit()
}

// credentialsByID loads the fields needed to re-verify a signed-in user.
func (r *userRepo) credentialsByID(q sqlx.Queryer, userID int64) (*User, error) {
	var u User
	err := sqlx.Get(q, &u, `SELECT id, email, password, role FROM users WHERE id = $1`, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, util.ErrUserNotFound
		}
		return nil, err
	}
	return &u, nil
}

func (r *userRepo) ChangePassword(userID int64, currentPassword, newPassword string) (*User, error) {
	u, err := r.credentialsByID(r.db, userID)
	if err != nil {
		return nil, err
	}
	if bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(currentPassword)) != nil {
		return nil, util.ErrCurrentPasswordIncorrect
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	// The password-hash guard makes a concurrent change (another device, same
	// moment) fail cleanly instead of silently overwriting it.
	var updated User
	err = r.db.Get(&updated, `
		UPDATE users SET password = $1, token_version = token_version + 1
		WHERE id = $2 AND password = $3
		RETURNING id, full_name, email, role, token_version
	`, string(hashed), userID, u.Password)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, util.ErrCurrentPasswordIncorrect
		}
		return nil, err
	}
	return &updated, nil
}

func (r *userRepo) DeleteAccount(userID int64, password string) error {
	tx, err := r.db.Beginx()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// FOR UPDATE: serialize against a concurrent request for the same account.
	var u User
	err = tx.Get(&u, `SELECT id, email, password, role FROM users WHERE id = $1 FOR UPDATE`, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return util.ErrUserNotFound
		}
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password)) != nil {
		return util.ErrCurrentPasswordIncorrect
	}
	// Admins author the global (fixed) tasks every user sees; tasks.created_by
	// has no ON DELETE action, so deleting an admin would either fail or (if
	// that ever changed) remove everyone's fixed tasks. Not self-service.
	if u.Role == "admin" {
		return util.ErrAdminCannotDeleteAccount
	}

	// Email-keyed rows have no FK to users, so remove them explicitly.
	if _, err := tx.Exec(`DELETE FROM email_otps WHERE email = $1`, u.Email); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM security_answer_attempt_logs WHERE email = $1`, u.Email); err != nil {
		return err
	}
	// Everything else (categories, tasks -> sub_tasks, completions, quran
	// data, push tokens) is ON DELETE CASCADE from users.
	if _, err := tx.Exec(`DELETE FROM users WHERE id = $1`, userID); err != nil {
		return err
	}

	return tx.Commit()
}

// VerifySecurityAnswer checks the supplied answer against the stored hash for email and
// returns the account's token version (for the single-use reset token). Every attempt is
// logged; after maxSecurityAnswerAttempts failures from one IP (or
// maxSecurityAnswerAttemptsPerEmail from all IPs) within securityAnswerLockDuration, further
// attempts answer ErrSecurityAnswerLocked. The user row is locked (FOR UPDATE) while counting,
// so parallel guesses can't slip past the limit. Errors are deliberately generic at the
// handler layer (same message for "no such user" / "no answer set" / "wrong answer") so this
// endpoint can't be used to enumerate registered emails or confirm partial answers.
func (r *userRepo) VerifySecurityAnswer(email, answer, ipAddress string) (int, error) {
	email = normalizeEmail(email)

	tx, err := r.db.Beginx()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	var u User
	err = tx.Get(&u, `
		SELECT id, email, security_answer_hash, token_version
		FROM users
		WHERE email = $1
		FOR UPDATE
	`, email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			r.logSecurityAnswerAttempt(email, false, ipAddress)
			return 0, util.ErrUserNotFound
		}
		return 0, err
	}

	// Failures since the last success, within the lock window.
	var counts struct {
		FromIP int `db:"from_ip"`
		Total  int `db:"total"`
	}
	err = tx.Get(&counts, `
		SELECT
			count(*) FILTER (WHERE ip_address = $2) AS from_ip,
			count(*)                                AS total
		FROM security_answer_attempt_logs
		WHERE email = $1 AND NOT success
		  AND created_at > GREATEST(
			now() - make_interval(secs => $3),
			COALESCE((SELECT max(created_at) FROM security_answer_attempt_logs WHERE email = $1 AND success), '-infinity')
		  )
	`, email, ipAddress, securityAnswerLockDuration.Seconds())
	if err != nil {
		return 0, err
	}

	fail := func(result error) (int, error) {
		if _, err := tx.Exec(`
			INSERT INTO security_answer_attempt_logs (email, success, ip_address) VALUES ($1, false, $2)
		`, email, ipAddress); err != nil {
			return 0, err
		}
		if err := tx.Commit(); err != nil {
			return 0, err
		}
		return 0, result
	}

	if counts.FromIP >= maxSecurityAnswerAttempts || counts.Total >= maxSecurityAnswerAttemptsPerEmail {
		return fail(util.ErrSecurityAnswerLocked)
	}
	if !u.SecurityAnswerHash.Valid || u.SecurityAnswerHash.String == "" {
		return fail(util.ErrSecurityAnswerNotSet)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.SecurityAnswerHash.String), []byte(answer)); err != nil {
		// This failure is the one that reaches a limit: say "locked" now.
		if counts.FromIP+1 >= maxSecurityAnswerAttempts || counts.Total+1 >= maxSecurityAnswerAttemptsPerEmail {
			return fail(util.ErrSecurityAnswerLocked)
		}
		return fail(util.ErrSecurityAnswerMismatch)
	}

	if _, err := tx.Exec(`
		INSERT INTO security_answer_attempt_logs (email, success, ip_address) VALUES ($1, true, $2)
	`, email, ipAddress); err != nil {
		return 0, err
	}
	// The legacy per-account counters are no longer used; clear any old lock.
	if _, err := tx.Exec(`
		UPDATE users SET security_answer_attempts = 0, security_answer_locked_until = NULL WHERE id = $1
	`, u.ID); err != nil {
		return 0, err
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return u.TokenVersion, nil
}

func (r *userRepo) logSecurityAnswerAttempt(email string, success bool, ipAddress string) {
	_, err := r.db.Exec(`
		INSERT INTO security_answer_attempt_logs (email, success, ip_address)
		VALUES ($1, $2, $3)
	`, email, success, ipAddress)
	if err != nil {
		slog.Error("failed to log security answer attempt", "error", err)
	}
}
