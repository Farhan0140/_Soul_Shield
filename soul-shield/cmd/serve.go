package cmd

import (
	"log/slog"
	"os"
	"soulsheld/config"
	"soulsheld/infra/db"
	"soulsheld/repo"
	"soulsheld/rest"
	"soulsheld/rest/handlers/admin"
	"soulsheld/rest/handlers/category"
	"soulsheld/rest/handlers/sync"
	"soulsheld/rest/handlers/task"
	"soulsheld/rest/handlers/user"
	"soulsheld/rest/middlewares"
	"time"
)

func Serve() {
	// One JSON line per log record (also captures the standard "log" package),
	// so Render's log search can filter by request_id / user_id / status.
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	cnf := config.GetConfig()
	if len(cnf.SecretKey) < 32 {
		slog.Warn("SECRETKEY is shorter than 32 characters; use at least 32 random bytes so session tokens can't be brute-forced")
	}

	dbCon, err := db.NewConnection(cnf.NeonDBconnStr)
	if err != nil {
		slog.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	dbCon.SetMaxOpenConns(10)
	dbCon.SetMaxIdleConns(5)
	dbCon.SetConnMaxLifetime(time.Minute * 5)

	err = db.MigrateDB(dbCon, "./migrations")
	if err != nil {
		slog.Error("database migration failed", "error", err)
		os.Exit(1)
	}

	userRepo := repo.NewUserRepo(dbCon)
	middlewares := middlewares.NewMiddleware(cnf, sessionStore{userRepo})

	taskRepo := repo.NewTaskRepo(dbCon)
	subTaskRepo := repo.NewSubTaskRepo(dbCon)
	categoryRepo := repo.NewCategoryRepo(dbCon)
	syncRepo := repo.NewSyncRepo(dbCon)
	pushRepo := repo.NewPushRepo(dbCon)

	userHandler := user.NewHandler(cnf, userRepo, pushRepo, middlewares)
	taskHandler := task.NewHandler(taskRepo, subTaskRepo, categoryRepo, pushRepo)
	categoryHandler := category.NewHandler(categoryRepo, pushRepo)
	syncHandler := sync.NewHandler(syncRepo)
	adminHandler := admin.NewHandler(repo.NewAdminStatsRepo(dbCon))

	server := rest.NewServer(
		cnf,
		middlewares,
		userHandler,
		taskHandler,
		categoryHandler,
		syncHandler,
		adminHandler,
	)
	server.Start()
}

// sessionStore adapts repo.UserRepo to middlewares.SessionStore.
type sessionStore struct{ users repo.UserRepo }

func (s sessionStore) SessionInfo(userID int64) (*middlewares.SessionInfo, error) {
	role, version, err := s.users.SessionState(userID)
	if err != nil {
		return nil, err
	}
	return &middlewares.SessionInfo{Role: role, TokenVersion: version}, nil
}
