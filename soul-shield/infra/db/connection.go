package db

import (
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/jmoiron/sqlx"
)

// NewConnection opens and pings the Postgres database at connStr. The caller
// logs the error (without the connection string, which holds the password).
func NewConnection(connStr string) (*sqlx.DB, error) {
	return sqlx.Connect("pgx", connStr)
}
