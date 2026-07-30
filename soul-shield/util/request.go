package util

import (
	"net/http"
	"strings"
)

// ClientIP returns the best-effort caller IP for audit logging (e.g. failed security-answer
// attempts). It trusts X-Forwarded-For only because Cors/Preflight already sit in front of
// this app behind a reverse proxy in production; falls back to RemoteAddr for local/dev.
func ClientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		parts := strings.Split(fwd, ",")
		return strings.TrimSpace(parts[0])
	}
	return r.RemoteAddr
}
