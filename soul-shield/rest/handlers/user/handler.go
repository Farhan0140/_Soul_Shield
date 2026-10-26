package user

import (
	"soulsheld/config"
	"soulsheld/repo"
	"soulsheld/rest/middlewares"
)

type Handler struct {
	cnf         *config.Config
	userRepo    repo.UserRepo
	otpRepo     repo.OTPRepo
	pushRepo    repo.PushRepo
	middlewares *middlewares.Middleware
}

func NewHandler(
	cnf *config.Config,
	userRepo repo.UserRepo,
	otpRepo repo.OTPRepo,
	pushRepo repo.PushRepo,
	middlewares *middlewares.Middleware,
) *Handler {
	return &Handler{
		cnf:         cnf,
		userRepo:    userRepo,
		otpRepo:     otpRepo,
		pushRepo:    pushRepo,
		middlewares: middlewares,
	}
}
