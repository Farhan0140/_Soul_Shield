package sync

import (
	"net/http"
	"soulsheld/repo"
	"soulsheld/util"
)

type Handler struct {
	syncRepo repo.SyncRepo
}

func NewHandler(syncRepo repo.SyncRepo) *Handler {
	return &Handler{syncRepo: syncRepo}
}

func getUserID(r *http.Request) (int64, bool) {
	val := r.Context().Value("userID")
	id, ok := val.(int64)
	if !ok {
		return 0, false
	}
	return int64(id), true
}

func unauthorized(w http.ResponseWriter) {
	util.SendError(w, map[string]string{"error": "Unauthorize"}, http.StatusUnauthorized)
}
