package middlewares

import "net/http"

// Cors answers browsers only for the allow-listed origins (config
// CORS_ORIGINS). Requests from other websites still reach the API (CORS is
// enforced by the browser, and the mobile app isn't a browser), but the
// browser won't let the other site's JavaScript read the response. "*" in the
// list allows every origin.
func Cors(allowedOrigins []string) func(http.Handler) http.Handler {
	allowAll := false
	allowed := make(map[string]bool, len(allowedOrigins))
	for _, o := range allowedOrigins {
		if o == "*" {
			allowAll = true
		}
		allowed[o] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := w.Header()
			// The answer depends on Origin: caches must not reuse it across origins.
			h.Add("Vary", "Origin")

			origin := r.Header.Get("Origin")
			if origin != "" && (allowAll || allowed[origin]) {
				h.Set("Access-Control-Allow-Origin", origin)
				h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE")
				// X-Timezone: the caller's IANA zone, so "today" is the user's day (util/clock.go).
				// X-Request-ID: optional client-supplied correlation id.
				h.Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Timezone, X-Request-ID")
				// Let browser JS read: the sliding-session renewal token, the 429
				// back-off hint, and the request id for error reports.
				h.Set("Access-Control-Expose-Headers", "X-Refreshed-Token, Retry-After, X-Request-ID")
				h.Set("Access-Control-Max-Age", "600")
			}
			h.Set("Content-Type", "application/json")

			next.ServeHTTP(w, r)
		})
	}
}
