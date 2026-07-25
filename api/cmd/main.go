package main

import (
	"net/http"

	"github.com/asifulhaque087/todo-go-lang/internal/app"
	"github.com/asifulhaque087/todo-go-lang/internal/module"
)

func main() {

	mux := http.NewServeMux()

	appModule := module.NewApp()
	server := app.NewServer(mux, appModule)
	server.Start()
}
