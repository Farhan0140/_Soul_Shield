package util

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type CustomClaims struct {
	ID        int64  `json:"id"`
	Full_Name string `json:"full_name"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	jwt.RegisteredClaims
}

const resetPasswordTokenPurpose = "password_reset"

// ResetPasswordClaims is issued only after a successful security-answer verification, and is
// scoped narrowly (short expiry + a purpose tag) so it can't be reused as a general auth token.
type ResetPasswordClaims struct {
	Email   string `json:"email"`
	Purpose string `json:"purpose"`
	jwt.RegisteredClaims
}

func CreateResetPasswordJWT(secret, email string) (string, error) {
	claims := ResetPasswordClaims{
		Email:   email,
		Purpose: resetPasswordTokenPurpose,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	signedToken, err := token.SignedString([]byte(secret))
	if err != nil {
		return "", err
	}

	return signedToken, nil
}

func VerifyResetPasswordJWT(secret, tokenString string) (*ResetPasswordClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &ResetPasswordClaims{},
		func(token *jwt.Token) (interface{}, error) {
			return []byte(secret), nil
		},
	)

	if err != nil {
		return nil, ErrInvalidResetToken
	}

	claims, ok := token.Claims.(*ResetPasswordClaims)
	if !ok || !token.Valid || claims.Purpose != resetPasswordTokenPurpose || claims.Email == "" {
		return nil, ErrInvalidResetToken
	}

	return claims, nil
}

func CreateJWT(secret string, data CustomClaims) (string, error) {
	data.RegisteredClaims = jwt.RegisteredClaims{
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(72 * time.Hour)),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, data)

	signedToken, err := token.SignedString([]byte(secret))
	if err != nil {
		return "", err
	}

	return signedToken, nil
}

func VerifyJWT(secret, tokenString string) (*CustomClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &CustomClaims{},
		func(token *jwt.Token) (interface{}, error) {
			return []byte(secret), nil
		},
	)

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*CustomClaims)
	if !ok || !token.Valid {
		return nil, err
	}

	return claims, nil
}
