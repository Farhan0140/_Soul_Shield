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
}

func NewHandler(taskRepo repo.TaskRepo, subTaskRepo repo.SubTaskRepo, categoryRepo repo.CategoryRepo) *Handler {
	return &Handler{
		taskRepo:     taskRepo,
		subTaskRepo:  subTaskRepo,
		categoryRepo: categoryRepo,
	}
}

// ---- Context Helpers ----

func getUserID(r *http.Request) (int64, bool) {
	val := r.Context().Value("userID")
	id, ok := val.(int64)
	if !ok {
		return 0, false
	}
	return int64(id), true
}

func getRole(r *http.Request) string {
	val := r.Context().Value("role")
	role, ok := val.(string)
	if !ok {
		return ""
	}
	return role
}

func unauthorized(w http.ResponseWriter) {
	util.SendError(w, map[string]string{"error": "Unauthorize"}, http.StatusUnauthorized)
}