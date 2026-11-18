package db

import (
	"log/slog"

	"github.com/jmoiron/sqlx"
	migrate "github.com/rubenv/sql-migrate"
)

// MigrateDB applies any pending migrations from dir. It runs on every boot of
// every instance: fine for the single Render instance this app uses (sql-migrate
// records applied migrations in gorp_migrations, so a re-run is a no-op). If the
// API is ever scaled to several instances, run migrations once from a release
// step instead, so two instances can't race on the same migration.
func MigrateDB(db *sqlx.DB, dir string) error {
	migrations := &migrate.FileMigrationSource{Dir: dir}

	applied, err := migrate.Exec(db.DB, "postgres", migrations, migrate.Up)
	if err != nil {
		return err
	}
	slog.Info("database migrations applied", "count", applied)
	return nil
}
