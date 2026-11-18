package category

import (
	"net/http"
	"soulsheld/repo"
	"soulsheld/util"
)

type Handler struct {
	categoryRepo repo.CategoryRepo
	// pushRepo tells the user's phones to catch-up-sync after a web edit
	// (B14). NotifyDataChange is async, debounced and best-effort.
	pushRepo repo.PushRepo
}

func NewHandler(categoryRepo repo.CategoryRepo, pushRepo repo.PushRepo) *Handler {
	return &Handler{categoryRepo: categoryRepo, pushRepo: pushRepo}
}

func unauthorized(w http.ResponseWriter) {
	util.SendError(w, map[string]string{"error": "Unauthorize"}, http.StatusUnauthorized)
}
