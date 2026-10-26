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
		"POST /users/verify-security-answer",

		manager.With(
			http.HandlerFunc(h.VerifySecurityAnswer),
		),
	)

	mux.Handle(
		"POST /users/reset-password",

		manager.With(
			http.HandlerFunc(h.ResetPassword),
		),
	)

	mux.Handle(
		"POST /users/push-token",

		manager.With(
			http.HandlerFunc(h.RegisterPushToken),
			h.middlewares.AuthenticateJWT,
		),
	)

	mux.Handle(
		"DELETE /users/push-token",

		manager.With(
			http.HandlerFunc(h.DeletePushToken),
			h.middlewares.AuthenticateJWT,
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
