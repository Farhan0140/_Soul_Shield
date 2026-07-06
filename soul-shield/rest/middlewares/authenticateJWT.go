package middlewares

import (
	"context"
	"net/http"
	"soulsheld/util"
	"strings"
)

func (m *Middleware) AuthenticateJWT(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if header == "" {
			util.SendError(w, map[string]string{
				"error": "Unauthorize",
			}, http.StatusUnauthorized)
			return 
		}
		
		headerArr := strings.Split(header, " ")
		if len(headerArr) != 2 || headerArr[0] != "JWT" {
			util.SendError(w, map[string]string{
				"error": "Unauthorize",
			}, http.StatusUnauthorized)
			return
		}
		
		customClaims, err := util.VerifyJWT(m.cnf.SecretKey, headerArr[1])
		if err != nil {
			util.SendError(w, map[string]string{
				"error": "Unauthorize",
			}, http.StatusUnauthorized)
			return
		}
		if customClaims == nil {
			util.SendError(w, map[string]string{
				"error": "Unauthorize",
			}, http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), "userID", customClaims.ID)
		ctx = context.WithValue(ctx, "role", customClaims.Role)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
