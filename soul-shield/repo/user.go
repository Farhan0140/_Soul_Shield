package repo

import (
	"database/sql"
	"errors"
	"fmt"
	"soulsheld/util"

	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

type User struct {
	ID        int    `json:"id" db:"id"`
	Full_Name string `json:"full_name" db:"full_name"`
	Email     string `json:"email" db:"email"`
	Password  string `json:"password" db:"password"`
}

type UserRepo interface {
	Create(user User) (*User, error)
	Find(email, password string) (*User, error)
	Update(email string, password string) error
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

	var verified bool

	err = tx.QueryRow(`
		SELECT verified
		FROM email_otps
		WHERE email = $1
	`, user.Email).Scan(&verified)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, util.ErrOTPNotFound
		}
		return nil, err
	}

	if !verified {
		return nil, util.ErrEmailNotVerified
	}

	hashedPassword, err := bcrypt.GenerateFromPassword(
		[]byte(user.Password),
		bcrypt.DefaultCost,
	)
	if err != nil {
		return nil, err
	}
	user.Password = string(hashedPassword)

	query := `
		INSERT INTO users (
			full_name,
			email,
			password
		) VALUES (
			$1,
			$2,
			$3
		)
		RETURNING id
	`

	row := tx.QueryRow(query, user.Full_Name, user.Email, user.Password)
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
		SELECT id, full_name, email, password
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