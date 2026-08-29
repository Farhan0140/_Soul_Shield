package category

import (
	"net/http"
	"soulsheld/rest/middlewares"
)

func (h *Handler) RegisterRoutes(mux *http.ServeMux, manager *middlewares.Manager, mw *middlewares.Middleware) {
	mux.Handle(
		"POST /categories",
		manager.With(
			http.HandlerFunc(h.CreateCategory),
			mw.AuthenticateJWT,
		),
	)

	mux.Handle(
		"GET /categories",
		manager.With(
			http.HandlerFunc(h.ListCategories),
			mw.AuthenticateJWT,
		),
	)

	mux.Handle(
		"PATCH /categories/reorder",
		manager.With(
			http.HandlerFunc(h.ReorderCategories),
			mw.AuthenticateJWT,
		),
	)

	mux.Handle(
		"PATCH /categories/{id}",
		manager.With(
			http.HandlerFunc(h.UpdateCategory),
			mw.AuthenticateJWT,
		),
	)

	mux.Handle(
		"DELETE /categories/{id}",
		manager.With(
			http.HandlerFunc(h.DeleteCategory),
			mw.AuthenticateJWT,
		),
	)
}