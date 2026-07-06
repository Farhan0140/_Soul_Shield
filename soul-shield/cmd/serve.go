package cmd

import (
	"fmt"
	"os"
	"soulsheld/config"
	"soulsheld/infra/db"
	"soulsheld/repo"
	"soulsheld/rest"
	otp "soulsheld/rest/handlers/opt"
	"soulsheld/rest/handlers/user"
	"soulsheld/rest/middlewares"
	"time"
)

func Serve() {
	cnf := config.GetConfig()
	dbCon, err := db.NewConnection(cnf.NeonDBconnStr)
	// dbCon, err := db.NewConnectionOffline(cnf.DB)
	
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
	dbCon.SetMaxOpenConns(10)
	dbCon.SetMaxIdleConns(5)
	dbCon.SetConnMaxLifetime(time.Minute * 5)

	err = db.MigrateDB(dbCon, "./migrations")
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}

	middlewares := middlewares.NewMiddleware(cnf)

	userRepo := repo.NewUserRepo(dbCon)
	otpRepo := repo.NewOtpRepo(dbCon)

	userHandler := user.NewHandler(cnf, userRepo, otpRepo, middlewares)
	otpHandler := otp.NewHandler(otpRepo)

	server := rest.NewServer(
		cnf,
		userHandler,
		otpHandler,
	)
	server.Start()
}
