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

func unauthorized(w http.ResponseWriter) {
	util.SendError(w, map[string]string{"error": "Unauthorize"}, http.StatusUnauthorized)
}
