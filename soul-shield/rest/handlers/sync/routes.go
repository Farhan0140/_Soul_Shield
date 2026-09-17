package sync

import (
	"net/http"
	"soulsheld/rest/middlewares"
)

func (h *Handler) RegisterRoutes(mux *http.ServeMux, manager *middlewares.Manager, mw *middlewares.Middleware) {
	mux.Handle(
		"GET /sync",
		manager.With(
			http.HandlerFunc(h.Pull),
			mw.AuthenticateJWT,
		),
	)

	mux.Handle(
		"POST /sync",
		manager.With(
			http.HandlerFunc(h.Push),
			mw.AuthenticateJWT,
		),
	)
}
