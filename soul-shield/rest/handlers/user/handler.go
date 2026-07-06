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
	middlewares *middlewares.Middleware
}

func NewHandler(
	cnf *config.Config,
	userRepo repo.UserRepo,
	otpRepo repo.OTPRepo,
	middlewares *middlewares.Middleware,
) *Handler {
	return &Handler{
		cnf:         cnf,
		userRepo:    userRepo,
		otpRepo: otpRepo,
		middlewares: middlewares,
	}
}
