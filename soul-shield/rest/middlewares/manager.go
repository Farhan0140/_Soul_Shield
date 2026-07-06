package middlewares

import "net/http"

type Middlewares func(http.Handler) http.Handler

type Manager struct {
	globalMiddlewares []Middlewares
}

func NewManager() *Manager {
	return &Manager{
		globalMiddlewares: make([]Middlewares, 0),
	}
}

func (mngr *Manager) Use(middlewares ...Middlewares) {
	mngr.globalMiddlewares = append(mngr.globalMiddlewares, middlewares...)
}

func (mngr *Manager) With(next http.Handler, middlewares ...Middlewares) http.Handler {
	h := next

	for _, middleware := range middlewares {
		h = middleware(h)
	}

	return h
}

func (mngr *Manager) WrapMux(next http.Handler) http.Handler {
	h := next

	for _, gblMiddleware := range mngr.globalMiddlewares {
		h = gblMiddleware(h)
	}

	return h
}
