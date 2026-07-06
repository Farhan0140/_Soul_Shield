package db

import (
	"fmt"
	"soulsheld/config"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/jmoiron/sqlx"
)

func getConnectionString(cnf *config.DBConfig) string {
	connStr := fmt.Sprintf("user=%s password=%s host=%s port=%d dbname=%s",
		cnf.User,
		cnf.Password,
		cnf.Host,
		cnf.Port,
		cnf.DBName,
	)

	if !cnf.EnableSSLMode {
		connStr += " sslmode=disable"
	}

	return connStr
}

func NewConnection(connStr string) (*sqlx.DB, error) {
	// dbSource := getConnectionString(cnf)
	dbSource := connStr

	dbCon, err := sqlx.Connect("pgx", dbSource)
	if err != nil {
		fmt.Println("DB Connection: ", err)
		return nil, err
	}

	return dbCon, nil
}

func NewConnectionOffline(cnf *config.DBConfig) (*sqlx.DB, error) {
	dbSource := getConnectionString(cnf)

	dbCon, err := sqlx.Connect("pgx", dbSource)
	if err != nil {
		fmt.Println("DB Connection: ", err)
		return nil, err
	}

	return dbCon, nil
}
