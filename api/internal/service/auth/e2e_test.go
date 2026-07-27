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
	"github.com/asifulhaque087/collab-grid/api/internal/util"
	"github.com/asifulhaque087/collab-grid/api/internal/service/auth"
)

func TestAdd(t *testing.T) {

	m := http.NewServeMux()
	testModule := module.NewTestModule()

	server := app.NewServer(m, testModule)
	mux := server.Init()

	ts := httptest.NewServer(mux)
	defer ts.Close()

	t.Run("Create user returns 201", func(t *testing.T) {
		body := []byte(`{"title": "drink water"}`)
		res, err := http.Post(ts.URL+"/users", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatal(err)
		}

		if res.StatusCode != http.StatusCreated {
			t.Errorf("expected 201, got %d", res.StatusCode)
		}

		testModule.AuthRepo.Reset()

	})

	t.Run("Create should response with appropriate data", func(t *testing.T) {

		body := []byte(`{"title": "hola"}`)
		res, err := http.Post(ts.URL+"/users", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatal(err)
		}

		respBody, _ := io.ReadAll(res.Body)
		res.Body.Close()
		if !bytes.Contains(respBody, []byte("hola")) {
			t.Errorf("response body missing name: %s", string(respBody))
		}

		testModule.AuthRepo.Reset()

	})

}

func TestFind(t *testing.T) {

	m := http.NewServeMux()
	testModule := module.NewTestModule()

	server := app.NewServer(m, testModule)
	mux := server.Init()

	ts := httptest.NewServer(mux)
	defer ts.Close()

	t.Run("It should find the newly created User", func(t *testing.T) {

		body := []byte(`{"title": "go for a walk"}`)
		res, err := http.Post(ts.URL+"/users", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatal(err)
		}

		currUser := testModule.AuthRepo.GetUsers()

		if len(*currUser) != 1 {
			t.Errorf("expected 1 user, got %d", len(*currUser))
		}

		testModule.AuthRepo.Reset()
	})

	t.Run("It should find a single user", func(t *testing.T) {

		body := []byte(`{"title": "go for a walk"}`)
		res, err := http.Post(ts.URL+"/users", "application/json", bytes.NewBuffer(body))

		if err != nil {
			t.Fatal(err)
		}

		respBody := util.ReadResponse(res.Body)

		var data auth.User
		if err := json.Unmarshal(respBody, &data); err != nil {
			t.Fatalf("Failed to decode JSON: %v", err)
		}

		newRes, err := http.Get(ts.URL + "/users/" + data.Id.Hex())

		if err != nil {
			t.Fatal(err)
		}

		newRespBody := util.ReadResponse(newRes.Body)

		var newData auth.User

		if err := json.Unmarshal(newRespBody, &newData); err != nil {
			t.Fatalf("Failed to decode JSON: %v", err)
		}

		if data.Title != newData.Title {
			t.Errorf("data is not same got %d", res.StatusCode)
		}

		testModule.AuthRepo.Reset()
	})

}
