package repo

import (
	"database/sql"
	// "errors"
	"fmt"
	"soulsheld/util"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

const (
	maxSecurityAnswerAttempts   = 5
	securityAnswerLockDuration  = 24 * time.Hour
)

type UserRepo interface {
	Create(user User) (*User, error)
	Find(email, password string) (*User, error)
	Update(email string, password string) error
	VerifySecurityAnswer(email, answer, ipAddress string) error
}

type userRepo struct {
	db *sqlx.DB
}

func NewUserRepo(db *sqlx.DB) UserRepo {
	return &userRepo{
		db: db,
	}
}

func (r *userRepo) Create(user User) (*User, error) {
	tx, err := r.db.Beginx()
	if err != nil {
		return nil, err
	}

	defer tx.Rollback()

	// var verified bool

	// err = tx.QueryRow(`
	// 	SELECT verified
	// 	FROM email_otps
	// 	WHERE email = $1
	// `, user.Email).Scan(&verified)

	// if err != nil {
	// 	if errors.Is(err, sql.ErrNoRows) {
	// 		return nil, util.ErrOTPNotFound
	// 	}
	// 	return nil, err
	// }

	// if !verified {
	// 	return nil, util.ErrEmailNotVerified
	// }

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
		if pqErr, ok := err.(*pq.Error); ok {
			if pqErr.Code == "23505" {
				return nil, util.ErrUserExists
			}
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
	var user User
	query := `
		SELECT id, full_name, email, password, role
		FROM users
		WHERE email = $1
		LIMIT 1
	`
	err := r.db.Get(&user, query, email)
	if err != nil {
		fmt.Println(err)
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
		fmt.Println(err)
		return nil, nil
	}

	return &user, nil
}

func (r *userRepo) Update(email string, password string) error {

	tx, err := r.db.Beginx()
	if err != nil {
		return err
	}

	defer tx.Rollback()

	hashedPassword, err := bcrypt.GenerateFromPassword(
		[]byte(password),
		bcrypt.DefaultCost,
	)

	if err != nil {
		return err
	}

	result, err := tx.Exec(`
		UPDATE users
		SET password=$1
		WHERE email=$2
	`,
		string(hashedPassword),
		email,
	)

	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()

	if rowsAffected == 0 {
		return util.ErrUserNotFound
	}

	_, err = tx.Exec(`
		UPDATE email_otps
		SET verified=false
		WHERE email=$1
	`,
		email,
	)

	if err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	return nil
}

// VerifySecurityAnswer checks the supplied answer against the stored hash for email.
// It always logs the attempt (success or failure) and enforces a lockout after
// maxSecurityAnswerAttempts consecutive failures. Errors are deliberately generic at the
// handler layer (same message for "no such user" / "no answer set" / "wrong answer") so this
// endpoint can't be used to enumerate registered emails or confirm partial answers.
func (r *userRepo) VerifySecurityAnswer(email, answer, ipAddress string) error {
	var u User
	err := r.db.Get(&u, `
		SELECT id, email, security_answer_hash, security_answer_attempts, security_answer_locked_until
		FROM users
		WHERE email = $1
		LIMIT 1
	`, email)

	if err != nil {
		if err == sql.ErrNoRows {
			r.logSecurityAnswerAttempt(email, false, ipAddress)
			return util.ErrUserNotFound
		}
		return err
	}

	if u.SecurityAnswerLockedUntil.Valid && u.SecurityAnswerLockedUntil.Time.After(time.Now()) {
		r.logSecurityAnswerAttempt(email, false, ipAddress)
		return util.ErrSecurityAnswerLocked
	}

	if !u.SecurityAnswerHash.Valid || u.SecurityAnswerHash.String == "" {
		r.logSecurityAnswerAttempt(email, false, ipAddress)
		return util.ErrSecurityAnswerNotSet
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.SecurityAnswerHash.String), []byte(answer)); err != nil {
		r.logSecurityAnswerAttempt(email, false, ipAddress)

		attempts := u.SecurityAnswerAttempts + 1
		if attempts >= maxSecurityAnswerAttempts {
			_, uErr := r.db.Exec(`
				UPDATE users
				SET security_answer_attempts = $1, security_answer_locked_until = $2
				WHERE email = $3
			`, attempts, time.Now().Add(securityAnswerLockDuration), email)
			if uErr != nil {
				return uErr
			}
			return util.ErrSecurityAnswerLocked
		}

		_, uErr := r.db.Exec(`
			UPDATE users SET security_answer_attempts = $1 WHERE email = $2
		`, attempts, email)
		if uErr != nil {
			return uErr
		}

		return util.ErrSecurityAnswerMismatch
	}

	_, err = r.db.Exec(`
		UPDATE users
		SET security_answer_attempts = 0, security_answer_locked_until = NULL
		WHERE email = $1
	`, email)
	if err != nil {
		return err
	}

	r.logSecurityAnswerAttempt(email, true, ipAddress)

	return nil
}

func (r *userRepo) logSecurityAnswerAttempt(email string, success bool, ipAddress string) {
	_, err := r.db.Exec(`
		INSERT INTO security_answer_attempt_logs (email, success, ip_address)
		VALUES ($1, $2, $3)
	`, email, success, ipAddress)
	if err != nil {
		fmt.Println("failed to log security answer attempt:", err)
	}
}
