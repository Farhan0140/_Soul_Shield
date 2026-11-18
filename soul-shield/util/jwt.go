package util

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Session tokens live 14 days but are renewed on use (see AuthLifetime /
// RenewAfter and middlewares.AuthenticateJWT), so an active user is never
// signed out while a stolen-and-idle token dies within two weeks. Every
// token also carries the account's token_version: changing or resetting the
// password bumps it, which revokes every token issued before.
const (
	AuthLifetime = 14 * 24 * time.Hour
	// RenewAfter: an authenticated request presenting a token older than this
	// gets a fresh one back in the X-Refreshed-Token response header.
	RenewAfter = 24 * time.Hour
	// RefreshedTokenHeader carries the renewed session token.
	RefreshedTokenHeader = "X-Refreshed-Token"

	authTokenType = "auth"
)

// Only HS256 is ever issued; refusing everything else closes the classic
// algorithm-confusion hole ("alg": "none" etc.).
var jwtParserOptions = []jwt.ParserOption{jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()})}

type CustomClaims struct {
	ID        int64  `json:"id"`
	Full_Name string `json:"full_name"`
	Email     string `json:"email"`
	// Role is informational for clients; the server always re-reads the role
	// from the database (AuthenticateJWT), so a demotion applies immediately.
	Role string `json:"role"`
	// TokenVersion must equal users.token_version for the token to be valid.
	// Tokens from before this field existed decode as 0, the column default,
	// so they keep working until the user's next password change.
	TokenVersion int `json:"ver"`
	// Type is "auth" on every session token issued from now on. Empty is
	// accepted for older tokens; anything else is rejected.
	Type string `json:"typ,omitempty"`
	// Purpose is only set on password-reset tokens; its presence here means
	// someone is presenting a reset token as a session token.
	Purpose string `json:"purpose,omitempty"`
	jwt.RegisteredClaims
}

const resetPasswordTokenPurpose = "password_reset"

// ResetPasswordClaims is issued only after a successful security-answer verification, and is
// scoped narrowly (short expiry + a purpose tag) so it can't be reused as a general auth token.
type ResetPasswordClaims struct {
	Email   string `json:"email"`
	Purpose string `json:"purpose"`
	// TokenVersion is the account's token_version when the token was issued.
	// The reset bumps it, so the same reset token can't be used twice.
	TokenVersion int `json:"ver"`
	jwt.RegisteredClaims
}

func CreateResetPasswordJWT(secret, email string, tokenVersion int) (string, error) {
	claims := ResetPasswordClaims{
		Email:        email,
		Purpose:      resetPasswordTokenPurpose,
		TokenVersion: tokenVersion,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func VerifyResetPasswordJWT(secret, tokenString string) (*ResetPasswordClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &ResetPasswordClaims{},
		func(token *jwt.Token) (interface{}, error) {
			return []byte(secret), nil
		},
		jwtParserOptions...,
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

// CreateJWT issues a session token. data.TokenVersion must be the user's
// current token_version.
func CreateJWT(secret string, data CustomClaims) (string, error) {
	now := time.Now()
	data.Type = authTokenType
	data.Purpose = ""
	data.RegisteredClaims = jwt.RegisteredClaims{
		ExpiresAt: jwt.NewNumericDate(now.Add(AuthLifetime)),
		IssuedAt:  jwt.NewNumericDate(now),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, data)
	return token.SignedString([]byte(secret))
}

var errNotSessionToken = errors.New("not a session token")

// VerifyJWT validates signature, algorithm, expiry and token type. It does
// NOT check token_version / that the user still exists; AuthenticateJWT does
// that against the database.
func VerifyJWT(secret, tokenString string) (*CustomClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &CustomClaims{},
		func(token *jwt.Token) (interface{}, error) {
			return []byte(secret), nil
		},
		jwtParserOptions...,
	)
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*CustomClaims)
	if !ok || !token.Valid {
		return nil, errNotSessionToken
	}
	if claims.Purpose != "" || (claims.Type != "" && claims.Type != authTokenType) || claims.ID <= 0 {
		return nil, errNotSessionToken
	}

	return claims, nil
}

// ShouldRenew reports whether a still-valid session token is old enough to be
// replaced with a fresh one.
func ShouldRenew(claims *CustomClaims) bool {
	if claims.IssuedAt == nil {
		return true
	}
	return time.Since(claims.IssuedAt.Time) > RenewAfter
}
