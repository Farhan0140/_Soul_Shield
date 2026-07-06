package middlewares

import (
	"net/http"
	"soulsheld/util"
)

func (m *Middleware) RequireRole(roles ...string) Middlewares {

	return func(next http.Handler) http.Handler {

		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

			role := r.Context().Value("role")

			if role == nil {
				util.SendError(w, map[string]string{
					"error": "Forbidden",
				}, http.StatusForbidden)
				return
			}

			userRole := role.(string)

			for _, allowedRole := range roles {

				if userRole == allowedRole {
					next.ServeHTTP(w, r)
					return
				}
			}

			util.SendError(w, map[string]string{
				"error": "Access Denied",
			}, http.StatusForbidden)
		})
	}
}
