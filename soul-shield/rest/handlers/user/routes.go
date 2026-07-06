package user

import (
	"net/http"
	"soulsheld/rest/middlewares"
)

func (h *Handler) RegisterRoutes(mux *http.ServeMux, manager *middlewares.Manager) {
	mux.Handle(
		"POST /users/register",

		manager.With(
			http.HandlerFunc(h.CreateUser),
		),
	)

	mux.Handle(
		"POST /users/login",

		manager.With(
			http.HandlerFunc(h.Login),
		),
	)

	mux.Handle(
		"POST /users/reset-password",

		manager.With(
			http.HandlerFunc(h.ResetPassword),
		),
	)

	mux.Handle(
		"GET /users/me",
		
		manager.With(
			http.HandlerFunc(h.GetUserByJWT),
			h.middlewares.AuthenticateJWT,
		),
	)
}