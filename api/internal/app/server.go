package app

import (
	"fmt"
	"log"
	"net/http"

	"github.com/asifulhaque087/collab-grid/api/internal/module"
)

type Server struct {
	mux    *http.ServeMux
	module module.Module
}

func NewServer(mux *http.ServeMux, module module.Module) *Server {

	return &Server{
		mux:    mux,
		module: module,
	}

}

func (s *Server) Init() *http.ServeMux {

	s.standardMiddleware()
	s.module.RegisterRoute(s.mux)

	return s.mux
}

func (s *Server) standardMiddleware() {

}

func (s *Server) Start(Port int) {

	mux := s.Init()

	server := &http.Server{
		// Addr:    ":4000",
		Addr:    fmt.Sprintf(":%d", Port),
		Handler: mux,
	}

	if err := server.ListenAndServe(); err != nil {
		log.Printf("HTTP server error: %v", err)
	}
}
