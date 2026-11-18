package util

import (
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
)

// trustedProxyHops is how many reverse proxies in front of the app APPEND to
// X-Forwarded-For (env TRUSTED_PROXY_HOPS). With N trusted hops the client IP
// is the N-th entry from the RIGHT: everything left of it could have been sent
// by the client itself, so it is spoofable.
//
// 0 (the default, kept for compatibility) uses the LEFTMOST entry, which a
// client can forge. Render's docs don't specify its header layout, so check a
// deployed request's X-Forwarded-For before setting this; a wrong value would
// make every user share one IP for the per-IP rate limits.
var (
	trustedProxyHopsOnce sync.Once
	trustedProxyHops     int
)

func proxyHops() int {
	trustedProxyHopsOnce.Do(func() {
		if n, err := strconv.Atoi(os.Getenv("TRUSTED_PROXY_HOPS")); err == nil && n > 0 {
			trustedProxyHops = n
		}
	})
	return trustedProxyHops
}

// ClientIP returns the best-effort caller IP for rate limiting and audit logs
// (e.g. failed security-answer attempts). See trustedProxyHops.
func ClientIP(r *http.Request) string {
	return clientIP(r, proxyHops())
}

func clientIP(r *http.Request, hops int) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		var parts []string
		for _, p := range strings.Split(fwd, ",") {
			if p = strings.TrimSpace(p); p != "" {
				parts = append(parts, p)
			}
		}
		if len(parts) > 0 {
			if hops <= 0 {
				return parts[0]
			}
			if hops <= len(parts) {
				return parts[len(parts)-hops]
			}
			// Fewer entries than trusted hops: the request didn't come
			// through all the proxies; fall back to the connection address.
		}
	}
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}
	return r.RemoteAddr
}
