package sync

import (
	"net/http"
	"soulsheld/repo"
	"soulsheld/util"
	"time"
)

type Handler struct {
	syncRepo repo.SyncRepo
	// globalByIP throttles the public GET /sync/global. Generous: phones
	// behind one carrier NAT share an IP, and each pulls on open/resume/
	// reconnect (the app itself waits 5 minutes between foreground pulls).
	globalByIP *util.RateLimiter
}

func NewHandler(syncRepo repo.SyncRepo) *Handler {
	return &Handler{syncRepo: syncRepo, globalByIP: util.NewRateLimiter(120, 15*time.Minute)}
}

func unauthorized(w http.ResponseWriter) {
	util.SendError(w, map[string]string{"error": "Unauthorize"}, http.StatusUnauthorized)
}
