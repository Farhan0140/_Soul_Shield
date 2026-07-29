package category

import (
	"net/http"
	"soulsheld/repo"
	"soulsheld/util"
)

type Handler struct {
	categoryRepo repo.CategoryRepo
}

func NewHandler(categoryRepo repo.CategoryRepo) *Handler {
	return &Handler{categoryRepo: categoryRepo}
}

// getUserID: JWT middleware থেকে context এ বসানো userID বের করে
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