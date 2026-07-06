package repo

import (
	"database/sql"
	"errors"
	"soulsheld/util"
	"time"

	"github.com/jmoiron/sqlx"
	"golang.org/x/crypto/bcrypt"
)

type OTPRepo interface {
	SaveOTP(email string, otp string,) error
	VerifyOTP(email string, otp string) (bool, error)
	IsVerified(email string) (bool, error)
}

type otpRepo struct {
	db *sqlx.DB
}

func NewOtpRepo(db *sqlx.DB) OTPRepo {
	return &otpRepo{
		db: db,
	}
}

func (r *otpRepo) SaveOTP(email string, otp string) error {

	hashedOTP, err := bcrypt.GenerateFromPassword(
		[]byte(otp),
		bcrypt.DefaultCost,
	)
	if err != nil {
		return err
	}

	_, err = r.db.Exec(`
		INSERT INTO email_otps(
			email,
			otp,
			expires_at
		)
		VALUES($1,$2,$3)
		ON CONFLICT(email)
		DO UPDATE SET
		otp=$2,
		expires_at=$3,
		verified=false
	`,
		email,
		hashedOTP,
		time.Now().Add(5*time.Minute),
	)

	return err
}


func (r *otpRepo) VerifyOTP(email string, otp string) (bool, error) {
	tx, err := r.db.Beginx()
	if err != nil {
		return false, nil 
	}

	defer tx.Rollback()

	var storedOTP string
	var expiresAt time.Time

	err = tx.QueryRow(`
		SELECT otp, expires_at
		FROM email_otps
		WHERE email=$1
	`,
		email,
	).Scan(
		&storedOTP,
		&expiresAt,
	)

	if err != nil {
		return false, err
	}

	if time.Now().After(expiresAt) {
		return false, nil
	}

	err = bcrypt.CompareHashAndPassword(
		[]byte(storedOTP),
		[]byte(otp),
	)
	if err != nil {
		return false, nil
	}

	// if storedOTP != otp {
	// 	return false, nil
	// }

	_, err = tx.Exec(`
		UPDATE email_otps
		SET verified=true
		WHERE email=$1
	`,
		email,
	)

	if err != nil {
		return false, err
	}

	if err := tx.Commit(); err != nil {
		return false, err
	}

	return true, nil
}

func (r *otpRepo) IsVerified(email string) (bool, error) {
	var verified bool

	err := r.db.QueryRow(`
		SELECT verified
		FROM email_otps
		WHERE email=$1
	`,
		email,
	).Scan(&verified)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, util.ErrOTPNotFound
		}
		return false, err
	}

	if !verified {
		return false, util.ErrEmailNotVerified
	}

	return verified, nil
}