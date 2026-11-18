package middlewares

import "soulsheld/config"

type Middleware struct {
	cnf      *config.Config
	sessions SessionStore
}

func NewMiddleware(cnf *config.Config, sessions SessionStore) *Middleware {
	return &Middleware{
		cnf:      cnf,
		sessions: sessions,
	}
}
