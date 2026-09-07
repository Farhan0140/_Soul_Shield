package quran

import (
	"net/http"
	"soulsheld/rest/middlewares"
)

func (h *Handler) RegisterRoutes(mux *http.ServeMux, manager *middlewares.Manager, mw *middlewares.Middleware) {
	mux.Handle(
		"GET /quran/last-read",
		manager.With(
			http.HandlerFunc(h.GetLastRead),
			mw.AuthenticateJWT,
		),
	)

	mux.Handle(
		"PUT /quran/last-read",
		manager.With(
			http.HandlerFunc(h.UpsertLastRead),
			mw.AuthenticateJWT,
		),
	)

	mux.Handle(
		"GET /quran/bookmarks",
		manager.With(
			http.HandlerFunc(h.ListBookmarks),
			mw.AuthenticateJWT,
		),
	)

	mux.Handle(
		"POST /quran/bookmarks",
		manager.With(
			http.HandlerFunc(h.CreateBookmark),
			mw.AuthenticateJWT,
		),
	)

	mux.Handle(
		"PATCH /quran/bookmarks/{id}",
		manager.With(
			http.HandlerFunc(h.UpdateBookmarkNote),
			mw.AuthenticateJWT,
		),
	)

	mux.Handle(
		"DELETE /quran/bookmarks/{id}",
		manager.With(
			http.HandlerFunc(h.DeleteBookmark),
			mw.AuthenticateJWT,
		),
	)
}
