package auth_test

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/asifulhaque087/collab-grid/api/internal/app"
	"github.com/asifulhaque087/collab-grid/api/internal/module"
	"github.com/go-chi/chi/v5"
)

func TestRegister(t *testing.T) {
	router := chi.NewRouter()
	testModule := module.NewTestModule()

	server := app.NewServer(router, testModule)
	r := server.Init()

	ts := httptest.NewServer(r)
	defer ts.Close()

		t.Run("Register user returns 201", func(t *testing.T) {
			body := []byte(`{"name": "John Doe", "email": "john@test.com", "password": "secret123"}`)
			res, err := http.Post(ts.URL+"/auth/register", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatal(err)
		}

		if res.StatusCode != http.StatusCreated {
			t.Errorf("expected 201, got %d", res.StatusCode)
		}
	})

		t.Run("Register with duplicate email returns 409", func(t *testing.T) {
			body := []byte(`{"name": "John Doe", "email": "john@test.com", "password": "secret123"}`)
			res, err := http.Post(ts.URL+"/auth/register", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatal(err)
		}

		if res.StatusCode != http.StatusConflict {
			t.Errorf("expected 409, got %d", res.StatusCode)
		}

		respBody, _ := io.ReadAll(res.Body)
		res.Body.Close()
		if !bytes.Contains(respBody, []byte("email already registered")) {
			t.Errorf("expected conflict error, got: %s", string(respBody))
		}
	})

		t.Run("Register response contains email", func(t *testing.T) {
			body := []byte(`{"name": "Jane Doe", "email": "jane@test.com", "password": "secret456"}`)
			res, err := http.Post(ts.URL+"/auth/register", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatal(err)
		}

		var resp map[string]any
		if err := json.NewDecoder(res.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		res.Body.Close()

		if resp["email"] != "jane@test.com" {
			t.Errorf("expected email jane@test.com, got %v", resp["email"])
		}
		if resp["name"] != "Jane Doe" {
			t.Errorf("expected name Jane Doe, got %v", resp["name"])
		}
		if resp["id"] == "" {
			t.Error("expected non-empty id")
		}
	})

	testModule.AuthRepo.Reset()
}
