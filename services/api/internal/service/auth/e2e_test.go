package auth_test

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/asifulhaque087/collab-grid/services/api/internal/app"
	"github.com/asifulhaque087/collab-grid/services/api/internal/module"
	"github.com/go-chi/chi/v5"
)

func registerUser(t *testing.T, ts *httptest.Server, email string) (token, userID string) {
	t.Helper()

	body := []byte(`{"name":"Test User","email":"` + email + `","password":"secret123"}`)
	res, err := http.Post(ts.URL+"/auth/register", "application/json", bytes.NewBuffer(body))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusCreated {
		t.Fatalf("register expected 201, got %d", res.StatusCode)
	}

	var resp map[string]any
	if err := json.NewDecoder(res.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode register response: %v", err)
	}

	token, _ = resp["accessToken"].(string)
	userID, _ = resp["id"].(string)

	if token == "" || userID == "" {
		t.Fatal("register response missing accessToken or id")
	}

	return token, userID
}

func authenticatedRequest(t *testing.T, ts *httptest.Server, method, path, token string, body []byte) *http.Response {
	t.Helper()

	req, err := http.NewRequest(method, ts.URL+path, bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	return res
}

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

func TestLogin(t *testing.T) {
	router := chi.NewRouter()
	testModule := module.NewTestModule()

	server := app.NewServer(router, testModule)
	r := server.Init()

	ts := httptest.NewServer(r)
	defer ts.Close()

	t.Run("login returns 200 with tokens", func(t *testing.T) {
		defer testModule.AuthRepo.Reset()

		registerUser(t, ts, "login@test.com")

		body := []byte(`{"email": "login@test.com", "password": "secret123"}`)
		res, err := http.Post(ts.URL+"/auth/login", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()

		if res.StatusCode != http.StatusOK {
			t.Fatalf("expected 200, got %d", res.StatusCode)
		}

		var resp map[string]any
		if err := json.NewDecoder(res.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if resp["id"] == "" {
			t.Error("expected non-empty id")
		}
		if resp["email"] != "login@test.com" {
			t.Errorf("expected email login@test.com, got %v", resp["email"])
		}
		if resp["accessToken"] == "" {
			t.Error("expected non-empty accessToken")
		}
		if resp["refreshToken"] == "" {
			t.Error("expected non-empty refreshToken")
		}
	})

	t.Run("login with wrong password returns 401", func(t *testing.T) {
		defer testModule.AuthRepo.Reset()

		registerUser(t, ts, "wrongpass@test.com")

		body := []byte(`{"email": "wrongpass@test.com", "password": "badpassword"}`)
		res, err := http.Post(ts.URL+"/auth/login", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()

		if res.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", res.StatusCode)
		}
	})

	t.Run("login with unknown email returns 401", func(t *testing.T) {
		defer testModule.AuthRepo.Reset()

		body := []byte(`{"email": "ghost@test.com", "password": "secret123"}`)
		res, err := http.Post(ts.URL+"/auth/login", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()

		if res.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", res.StatusCode)
		}
	})

	testModule.AuthRepo.Reset()
}

func TestLimitGuard(t *testing.T) {
	router := chi.NewRouter()
	testModule := module.NewTestModule()

	server := app.NewServer(router, testModule)
	r := server.Init()

	ts := httptest.NewServer(r)
	defer ts.Close()

	t.Run("backoffice user (no subscription) passes through", func(t *testing.T) {
		defer testModule.LimitGuardRepo.Reset()
		defer testModule.AuthRepo.Reset()

		token, userID := registerUser(t, ts, "backoffice@test.com")

		_, err := testModule.Enforcer.AddPolicy(userID, "/auth/demo", "POST")
		if err != nil {
			t.Fatal(err)
		}

		res := authenticatedRequest(t, ts, "POST", "/auth/demo", token, nil)
		defer res.Body.Close()

		if res.StatusCode != http.StatusOK {
			t.Errorf("expected 200, got %d", res.StatusCode)
		}
	})

	t.Run("post within limit succeeds", func(t *testing.T) {
		defer testModule.LimitGuardRepo.Reset()
		defer testModule.AuthRepo.Reset()

		token, userID := registerUser(t, ts, "within@test.com")

		const pkgID = "00000000-0000-0000-0000-000000000010"
		const limit = 3

		testModule.LimitGuardRepo.AddSubscriptionStr(userID, pkgID)
		testModule.LimitGuardRepo.AddPermissionLimitStr(pkgID, "/auth/demo", "POST", limit)

		_, err := testModule.Enforcer.AddPolicy(userID, "/auth/demo", "POST")
		if err != nil {
			t.Fatal(err)
		}

		for i := 0; i < limit; i++ {
			res := authenticatedRequest(t, ts, "POST", "/auth/demo", token, nil)
			res.Body.Close()

			if res.StatusCode != http.StatusOK {
				t.Errorf("attempt %d: expected 200, got %d", i+1, res.StatusCode)
			}
		}
	})

	t.Run("post exceeding limit returns 403", func(t *testing.T) {
		defer testModule.LimitGuardRepo.Reset()
		defer testModule.AuthRepo.Reset()

		token, userID := registerUser(t, ts, "exceed@test.com")

		const pkgID = "00000000-0000-0000-0000-000000000020"
		const limit int32 = 2

		testModule.LimitGuardRepo.AddSubscriptionStr(userID, pkgID)
		testModule.LimitGuardRepo.AddPermissionLimitStr(pkgID, "/auth/demo", "POST", limit)

		_, err := testModule.Enforcer.AddPolicy(userID, "/auth/demo", "POST")
		if err != nil {
			t.Fatal(err)
		}

		// Consume the limit
		for i := 0; i < int(limit); i++ {
			res := authenticatedRequest(t, ts, "POST", "/auth/demo", token, nil)
			res.Body.Close()

			if res.StatusCode != http.StatusOK {
				t.Fatalf("expected 200 on attempt %d, got %d", i+1, res.StatusCode)
			}
		}

		// Next should be 403
		res := authenticatedRequest(t, ts, "POST", "/auth/demo", token, nil)
		defer res.Body.Close()

		if res.StatusCode != http.StatusForbidden {
			t.Errorf("expected 403, got %d", res.StatusCode)
		}

		body, _ := io.ReadAll(res.Body)
		if !bytes.Contains(body, []byte("reached its limit")) {
			t.Errorf("expected limit error, got: %s", string(body))
		}
	})

	t.Run("delete decrements usage allowing more posts", func(t *testing.T) {
		defer testModule.LimitGuardRepo.Reset()
		defer testModule.AuthRepo.Reset()

		token, userID := registerUser(t, ts, "decrement@test.com")

		const pkgID = "00000000-0000-0000-0000-000000000030"
		const limit int32 = 3

		testModule.LimitGuardRepo.AddSubscriptionStr(userID, pkgID)
		testModule.LimitGuardRepo.AddPermissionLimitStr(pkgID, "/auth/demo", "POST", limit)

		_, err := testModule.Enforcer.AddPolicy(userID, "/auth/demo", "POST")
		if err != nil {
			t.Fatal(err)
		}
		_, err = testModule.Enforcer.AddPolicy(userID, "/auth/demo", "DELETE")
		if err != nil {
			t.Fatal(err)
		}

		// POST 3 times → used = 3
		for i := 0; i < 3; i++ {
			res := authenticatedRequest(t, ts, "POST", "/auth/demo", token, nil)
			res.Body.Close()
			if res.StatusCode != http.StatusOK {
				t.Fatalf("POST attempt %d: expected 200, got %d", i+1, res.StatusCode)
			}
		}

		// DELETE 2 times → used = 1
		for i := 0; i < 2; i++ {
			res := authenticatedRequest(t, ts, "DELETE", "/auth/demo", token, nil)
			res.Body.Close()
			if res.StatusCode != http.StatusOK {
				t.Fatalf("DELETE attempt %d: expected 200, got %d", i+1, res.StatusCode)
			}
		}

		// POST 3 more times → first 2 succeed, 3rd should 403
		for i := 0; i < 2; i++ {
			res := authenticatedRequest(t, ts, "POST", "/auth/demo", token, nil)
			res.Body.Close()
			if res.StatusCode != http.StatusOK {
				t.Errorf("POST after decrement attempt %d: expected 200, got %d", i+1, res.StatusCode)
			}
		}

		res := authenticatedRequest(t, ts, "POST", "/auth/demo", token, nil)
		defer res.Body.Close()
		if res.StatusCode != http.StatusForbidden {
			t.Errorf("expected 403 after exhausting quota, got %d", res.StatusCode)
		}
	})

	t.Run("unlimited limit (-1) always passes", func(t *testing.T) {
		defer testModule.LimitGuardRepo.Reset()
		defer testModule.AuthRepo.Reset()

		token, userID := registerUser(t, ts, "unlimited@test.com")

		const pkgID = "00000000-0000-0000-0000-000000000040"

		testModule.LimitGuardRepo.AddSubscriptionStr(userID, pkgID)
		testModule.LimitGuardRepo.AddPermissionLimitStr(pkgID, "/auth/demo", "POST", -1)

		_, err := testModule.Enforcer.AddPolicy(userID, "/auth/demo", "POST")
		if err != nil {
			t.Fatal(err)
		}

		for i := 0; i < 10; i++ {
			res := authenticatedRequest(t, ts, "POST", "/auth/demo", token, nil)
			res.Body.Close()

			if res.StatusCode != http.StatusOK {
				t.Errorf("attempt %d: expected 200, got %d", i+1, res.StatusCode)
			}
		}
	})

	t.Run("get request bypasses limit middleware", func(t *testing.T) {
		defer testModule.LimitGuardRepo.Reset()
		defer testModule.AuthRepo.Reset()

		token, userID := registerUser(t, ts, "getbypass@test.com")

		const pkgID = "00000000-0000-0000-0000-000000000050"

		testModule.LimitGuardRepo.AddSubscriptionStr(userID, pkgID)
		testModule.LimitGuardRepo.AddPermissionLimitStr(pkgID, "/auth/demo", "GET", 0)

		_, err := testModule.Enforcer.AddPolicy(userID, "/auth/demo", "GET")
		if err != nil {
			t.Fatal(err)
		}

		res := authenticatedRequest(t, ts, "GET", "/auth/demo", token, nil)
		defer res.Body.Close()

		if res.StatusCode != http.StatusOK {
			t.Errorf("expected 200, got %d", res.StatusCode)
		}
	})
}
