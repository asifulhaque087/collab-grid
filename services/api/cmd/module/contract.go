package module

import "github.com/go-chi/chi/v5"

type Module interface {
	RegisterRoute(r chi.Router)
}
