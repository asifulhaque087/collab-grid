package module

import "net/http"

type Module interface {
	RegisterRoute(mux *http.ServeMux)
}
