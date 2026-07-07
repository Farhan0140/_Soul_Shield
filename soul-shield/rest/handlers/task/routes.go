package task

import (
	"net/http"
	"soulsheld/rest/middlewares"
)

func (h *Handler) RegisterRoutes(mux *http.ServeMux, manager *middlewares.Manager, mw *middlewares.Middleware) {
	mux.Handle(
		"POST /tasks",
		manager.With(
			http.HandlerFunc(h.CreateTask),
			mw.AuthenticateJWT,
		),
	)

	mux.Handle(
		"GET /tasks",
		manager.With(
			http.HandlerFunc(h.ListTasks),
			mw.AuthenticateJWT,
		),
	)

	mux.Handle(
		"GET /tasks/history",
		manager.With(
			http.HandlerFunc(h.TaskHistory),
			mw.AuthenticateJWT,
		),
	)

	mux.Handle(
		"PATCH /tasks/{id}",
		manager.With(
			http.HandlerFunc(h.UpdateTask),
			mw.AuthenticateJWT,
		),
	)

	mux.Handle(
		"DELETE /tasks/{id}",
		manager.With(
			http.HandlerFunc(h.DeleteTask),
			mw.AuthenticateJWT,
		),
	)

	mux.Handle(
		"POST /tasks/{id}/complete",
		manager.With(
			http.HandlerFunc(h.CompleteTask),
			mw.AuthenticateJWT,
		),
	)

	mux.Handle(
		"POST /tasks/{id}/increment",
		manager.With(
			http.HandlerFunc(h.IncrementTask),
			mw.AuthenticateJWT,
		),
	)
}
