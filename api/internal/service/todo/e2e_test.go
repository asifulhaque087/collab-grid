package todo_test

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/asifulhaque087/todo-go-lang/internal/app"
	"github.com/asifulhaque087/todo-go-lang/internal/module"
	"github.com/asifulhaque087/todo-go-lang/internal/service/todo"
	"github.com/asifulhaque087/todo-go-lang/internal/util"
)

func TestAdd(t *testing.T) {

	m := http.NewServeMux()
	testModule := module.NewTestModule()

	server := app.NewServer(m, testModule)
	mux := server.Init()

	ts := httptest.NewServer(mux)
	defer ts.Close()

	t.Run("Create todo returns 201", func(t *testing.T) {
		body := []byte(`{"title": "drink water"}`)
		res, err := http.Post(ts.URL+"/todos", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatal(err)
		}

		if res.StatusCode != http.StatusCreated {
			t.Errorf("expected 201, got %d", res.StatusCode)
		}

		testModule.TodoRepo.Reset()

	})

	t.Run("Create should response with appropiate data", func(t *testing.T) {

		body := []byte(`{"title": "hola"}`)
		res, err := http.Post(ts.URL+"/todos", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatal(err)
		}

		// Verify body response
		respBody, _ := io.ReadAll(res.Body)
		res.Body.Close()
		if !bytes.Contains(respBody, []byte("hola")) {
			t.Errorf("response body missing name: %s", string(respBody))
		}

		testModule.TodoRepo.Reset()

	})

}

func TestFind(t *testing.T) {

	m := http.NewServeMux()
	testModule := module.NewTestModule()

	server := app.NewServer(m, testModule)
	mux := server.Init()

	ts := httptest.NewServer(mux)
	defer ts.Close()

	t.Run("It should find the newly created Todo", func(t *testing.T) {

		body := []byte(`{"title": "go for a walk"}`)
		res, err := http.Post(ts.URL+"/todos", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatal(err)
		}

		currTodo := testModule.TodoRepo.GetTodos()

		if len(*currTodo) != 1 {
			t.Errorf("expected 201, got %d", res.StatusCode)
		}

		testModule.TodoRepo.Reset()
	})

	t.Run("It should find a single todo", func(t *testing.T) {

		body := []byte(`{"title": "go for a walk"}`)
		res, err := http.Post(ts.URL+"/todos", "application/json", bytes.NewBuffer(body))

		if err != nil {
			t.Fatal(err)
		}

		respBody := util.ReadResponse(res.Body)

		var data todo.Todo
		if err := json.Unmarshal(respBody, &data); err != nil {
			t.Fatalf("Failed to decode JSON: %v", err)
		}

		newRes, err := http.Get(ts.URL + "/todos/" + data.Id.Hex())

		if err != nil {
			t.Fatal(err)
		}

		newRespBody := util.ReadResponse(newRes.Body)

		var newData todo.Todo

		if err := json.Unmarshal(newRespBody, &newData); err != nil {
			t.Fatalf("Failed to decode JSON: %v", err)
		}

		if data.Title != newData.Title {
			t.Errorf("data is not same goten %d", res.StatusCode)
		}

		testModule.TodoRepo.Reset()
	})

}
