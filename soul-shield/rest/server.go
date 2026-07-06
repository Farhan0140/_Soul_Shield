package rest

import (
	"fmt"
	"net/http"
	"os"
	"soulsheld/config"
	otp "soulsheld/rest/handlers/opt"
	"soulsheld/rest/handlers/task"
	"soulsheld/rest/handlers/user"
	"soulsheld/rest/middlewares"
	"strconv"

	httpSwagger "github.com/swaggo/http-swagger"
)

type Server struct {
	cnf         *config.Config
	middlewares *middlewares.Middleware
	userHandler *user.Handler
	otpHandler  *otp.Handler
	taskHandler *task.Handler
}

func NewServer(
	cnf *config.Config,
	mw *middlewares.Middleware,
	userHandler *user.Handler,
	otpHandler *otp.Handler,
	taskHandler *task.Handler,
) *Server {
	return &Server{
		cnf:         cnf,
		middlewares: mw,
		userHandler: userHandler,
		otpHandler:  otpHandler,
		taskHandler: taskHandler,
	}
}

func (server *Server) Start() {
	manager := middlewares.NewManager()
	manager.Use(
		middlewares.Preflight,
		middlewares.Cors,
		middlewares.Logger,
	)

	mux := http.NewServeMux()

	// Swagger Route
	mux.Handle(
		"/swagger/",
		httpSwagger.WrapHandler,
	)

	wrappedMux := manager.WrapMux(mux)

	server.userHandler.RegisterRoutes(mux, manager)
	server.otpHandler.RegisterRoutes(mux)
	server.taskHandler.RegisterRoutes(mux, manager, server.middlewares)

	// addr := ":" + strconv.Itoa(server.cnf.HttpPort)
	// fmt.Println("Server is Running on port ", addr)
	port := os.Getenv("PORT")
	if port == "" {
		port = strconv.Itoa(server.cnf.HttpPort) // fallback for local dev
	}

	addr := ":" + port

	fmt.Println("Server is Running on port", addr)
	err := http.ListenAndServe(addr, wrappedMux)
	if err != nil {
		fmt.Println("Error Occurred while starting the server: ", err)
		os.Exit(1)
	}
}
