package app

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/asifulhaque087/loot-board/services/api/cmd/module"
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

// func (s *Server) Start(port int) {
// 	router := s.Init()

// 	server := &http.Server{
// 		Addr:    fmt.Sprintf(":%d", port),
// 		Handler: router,
// 	}

// 	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
// 		log.Printf("HTTP server error: %v", err)
// 	}
// }

func (s *Server) Start(port int) {
	router := s.Init()

	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", port),
		Handler: router,
	}

	// 1. Channel to listen for OS signals
	shutdownChan := make(chan os.Signal, 1)
	signal.Notify(shutdownChan, os.Interrupt, syscall.SIGTERM, syscall.SIGINT)

	// 2. Start server in a background goroutine
	go func() {
		log.Printf("Server listening on port %d...", port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	// 3. Block until SIGTERM or SIGINT is received
	sig := <-shutdownChan
	log.Printf("Received signal %v. Initiating graceful shutdown...", sig)

	// 4. Create timeout context for active requests to finish
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 5. Gracefully stop the HTTP server
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("HTTP server forced shutdown error: %v", err)
	} else {
		log.Println("HTTP server stopped gracefully")
	}
}
