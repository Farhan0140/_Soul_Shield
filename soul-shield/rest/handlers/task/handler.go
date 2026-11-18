package task

import (
	"net/http"
	"soulsheld/repo"
	"soulsheld/util"
)

type Handler struct {
	taskRepo     repo.TaskRepo
	subTaskRepo  repo.SubTaskRepo
	categoryRepo repo.CategoryRepo
	// Best-effort cross-device sync alerts: fired after every successful REST
	// task mutation (web edits) so the user's other devices catch up
	// immediately. NotifyDataChange is async and swallows its own errors.
	pushRepo repo.PushRepo
}

func NewHandler(taskRepo repo.TaskRepo, subTaskRepo repo.SubTaskRepo, categoryRepo repo.CategoryRepo, pushRepo repo.PushRepo) *Handler {
	return &Handler{
		taskRepo:     taskRepo,
		subTaskRepo:  subTaskRepo,
		categoryRepo: categoryRepo,
		pushRepo:     pushRepo,
	}
}

// ---- Response Helpers ----

func unauthorized(w http.ResponseWriter) {
	util.SendError(w, map[string]string{"error": "Unauthorize"}, http.StatusUnauthorized)
}
