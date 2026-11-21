package rest

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"soulsheld/config"
	"soulsheld/rest/handlers/admin"
	"soulsheld/rest/handlers/category"
	"soulsheld/rest/handlers/health"
	"soulsheld/rest/handlers/sync"
	"soulsheld/rest/handlers/task"
	"soulsheld/rest/handlers/user"
	"soulsheld/rest/middlewares"
	"soulsheld/util"
	"strconv"
	"syscall"
	"time"

	httpSwagger "github.com/swaggo/http-swagger"
)

type Server struct {
	cnf             *config.Config
	middlewares     *middlewares.Middleware
	userHandler     *user.Handler
	taskHandler     *task.Handler
	categoryHandler *category.Handler
	syncHandler     *sync.Handler
	adminHandler    *admin.Handler
	healthHandler   *health.Handler
}

func NewServer(
	cnf *config.Config,
	mw *middlewares.Middleware,
	userHandler *user.Handler,
	taskHandler *task.Handler,
	categoryHandler *category.Handler,
	syncHandler *sync.Handler,
	adminHandler *admin.Handler,
	healthHandler *health.Handler,
) *Server {
	return &Server{
		cnf:             cnf,
		middlewares:     mw,
		userHandler:     userHandler,
		taskHandler:     taskHandler,
		categoryHandler: categoryHandler,
		syncHandler:     syncHandler,
		adminHandler:    adminHandler,
		healthHandler:   healthHandler,
	}
}

func (server *Server) Start() {
	manager := middlewares.NewManager()
	// WrapMux applies these in order, so the LAST one is the outermost:
	// RequestLogger sees everything (including Recover's 500), LimitBody runs
	// before any handler reads the body.
	manager.Use(
		middlewares.Preflight,
		middlewares.Cors(server.cnf.CorsOrigins),
		middlewares.LimitBody,
		middlewares.Recover,
		middlewares.RequestLogger,
	)

	mux := http.NewServeMux()

	// Swagger Route
	mux.Handle(
		"/swagger/",
		httpSwagger.WrapHandler,
	)

	// Liveness probe: no auth, no database. Used by Render's health check and
	// by the web client to wake a sleeping instance before the first real call.
	// For a check that also pings the database, see GET /health
	// (rest/handlers/health).
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		util.SendData(w, map[string]string{"status": "ok"}, http.StatusOK)
	})

	wrappedMux := manager.WrapMux(mux)

	server.userHandler.RegisterRoutes(mux, manager)
	server.taskHandler.RegisterRoutes(mux, manager, server.middlewares)
	server.categoryHandler.RegisterRoutes(mux, manager, server.middlewares)
	server.syncHandler.RegisterRoutes(mux, manager, server.middlewares)
	server.adminHandler.RegisterRoutes(mux, manager, server.middlewares)
	server.healthHandler.RegisterRoutes(mux, manager)

	port := os.Getenv("PORT")
	if port == "" {
		port = strconv.Itoa(server.cnf.HttpPort) // fallback for local dev
	}

	// Explicit timeouts: http.ListenAndServe has none, so one slow (or
	// malicious) client could hold a connection - and a DB pool slot - open
	// indefinitely on this small instance.
	httpServer := &http.Server{
		Addr:              ":" + port,
		Handler:           wrappedMux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		// Generous: a large sync push against a just-woken database is the
		// slowest legitimate request.
		WriteTimeout:   60 * time.Second,
		IdleTimeout:    120 * time.Second,
		MaxHeaderBytes: 64 << 10,
	}

	// Graceful shutdown (C6): Render sends SIGTERM on every deploy and waits
	// ~30s before killing the process. Stop accepting new connections and let
	// in-flight requests (a sync push mid-transaction, say) finish first.
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGTERM, os.Interrupt)
	serveErr := make(chan error, 1)
	go func() {
		slog.Info("server starting", "addr", httpServer.Addr)
		serveErr <- httpServer.ListenAndServe()
	}()

	select {
	case err := <-serveErr:
		slog.Error("server stopped", "error", err)
		os.Exit(1)
	case sig := <-stop:
		slog.Info("shutting down", "signal", sig.String())
		ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
		defer cancel()
		if err := httpServer.Shutdown(ctx); err != nil {
			slog.Error("graceful shutdown failed", "error", err)
			os.Exit(1)
		}
		slog.Info("server stopped cleanly")
	}
}
