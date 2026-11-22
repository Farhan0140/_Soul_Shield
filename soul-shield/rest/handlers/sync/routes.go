package sync

import (
	"net/http"
	"soulsheld/rest/middlewares"
)

func (h *Handler) RegisterRoutes(mux *http.ServeMux, manager *middlewares.Manager, mw *middlewares.Middleware) {
	// Public: fixed (admin-created) tasks only, no login - so the app can
	// show them to people using it without an account.
	mux.Handle(
		"GET /sync/global",
		manager.With(http.HandlerFunc(h.PullGlobal)),
	)

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
