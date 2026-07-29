package app

import (
	"fmt"
	"log"
	"net/http"

	"github.com/asifulhaque087/collab-grid/api/internal/module"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

type Server struct {
	router *chi.Mux
	module module.Module
}

func NewServer(router *chi.Mux, module module.Module) *Server {
	return &Server{
		router: router,
		module: module,
	}
}

func (s *Server) Init() *chi.Mux {
	s.standardMiddleware()
	s.module.RegisterRoute(s.router)

	return s.router
}

func (s *Server) standardMiddleware() {
	// Standard Chi middlewares
	s.router.Use(middleware.Logger)
	s.router.Use(middleware.Recoverer)
}

func (s *Server) Start(port int) {
	router := s.Init()

	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", port),
		Handler: router,
	}

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Printf("HTTP server error: %v", err)
	}
}
