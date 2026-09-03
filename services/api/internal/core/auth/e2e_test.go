package auth_test

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/asifulhaque087/loot-board/services/api/internal/app"
	"github.com/asifulhaque087/loot-board/services/api/internal/module"
	"github.com/go-chi/chi/v5"
)

func registerUser(t *testing.T, ts *httptest.Server, email string) (token, userID string) {
	t.Helper()

	body := []byte(`{"name":"Test User","email":"` + email + `","password":"secret123"}`)
	res, err := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewBuffer(body))
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
		res, err := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatal(err)
		}

		if res.StatusCode != http.StatusCreated {
			t.Errorf("expected 201, got %d", res.StatusCode)
		}
	})

	t.Run("Register with duplicate email returns 409", func(t *testing.T) {
		body := []byte(`{"name": "John Doe", "email": "john@test.com", "password": "secret123"}`)
		res, err := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewBuffer(body))
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
		res, err := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewBuffer(body))
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
		res, err := http.Post(ts.URL+"/api/v1/auth/login", "application/json", bytes.NewBuffer(body))
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
		res, err := http.Post(ts.URL+"/api/v1/auth/login", "application/json", bytes.NewBuffer(body))
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
		res, err := http.Post(ts.URL+"/api/v1/auth/login", "application/json", bytes.NewBuffer(body))
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

func TestForgotPassword(t *testing.T) {
	router := chi.NewRouter()
	testModule := module.NewTestModule()

	server := app.NewServer(router, testModule)
	r := server.Init()

	ts := httptest.NewServer(r)
	defer ts.Close()

	t.Run("forgot password for existing user returns 200", func(t *testing.T) {
		defer testModule.AuthRepo.Reset()

		registerUser(t, ts, "forgot@test.com")

		body := []byte(`{"email": "forgot@test.com"}`)
		res, err := http.Post(ts.URL+"/api/v1/auth/forgot-password", "application/json", bytes.NewBuffer(body))
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

		msg, _ := resp["message"].(string)
		if msg != "If an account with that email exists, a reset link has been sent." {
			t.Errorf("unexpected message: %v", msg)
		}
	})

	t.Run("forgot password for unknown email returns 200 with same message", func(t *testing.T) {
		defer testModule.AuthRepo.Reset()

		body := []byte(`{"email": "ghost@test.com"}`)
		res, err := http.Post(ts.URL+"/api/v1/auth/forgot-password", "application/json", bytes.NewBuffer(body))
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

		msg, _ := resp["message"].(string)
		if msg != "If an account with that email exists, a reset link has been sent." {
			t.Errorf("unexpected message: %v", msg)
		}
	})

	t.Run("forgot password with invalid email returns 400", func(t *testing.T) {
		defer testModule.AuthRepo.Reset()

		body := []byte(`{"email": "not-an-email"}`)
		res, err := http.Post(ts.URL+"/api/v1/auth/forgot-password", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()

		if res.StatusCode != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", res.StatusCode)
		}
	})

	t.Run("forgot password with missing email returns 400", func(t *testing.T) {
		defer testModule.AuthRepo.Reset()

		body := []byte(`{}`)
		res, err := http.Post(ts.URL+"/api/v1/auth/forgot-password", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()

		if res.StatusCode != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", res.StatusCode)
		}
	})

	testModule.AuthRepo.Reset()
}

func TestResetPassword(t *testing.T) {
	router := chi.NewRouter()
	testModule := module.NewTestModule()

	server := app.NewServer(router, testModule)
	r := server.Init()

	ts := httptest.NewServer(r)
	defer ts.Close()

	t.Run("reset password full flow works", func(t *testing.T) {
		defer testModule.AuthRepo.Reset()
		defer testModule.MailRepo.Reset()

		registerUser(t, ts, "reset@test.com")

		forgotBody := []byte(`{"email": "reset@test.com"}`)
		res, err := http.Post(ts.URL+"/api/v1/auth/forgot-password", "application/json", bytes.NewBuffer(forgotBody))
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if res.StatusCode != http.StatusOK {
			t.Fatalf("forgot-password expected 200, got %d", res.StatusCode)
		}

		token := testModule.MailRepo.LastResetToken()
		if token == "" {
			t.Fatal("expected non-empty token from fake mail")
		}

		resetBody, _ := json.Marshal(map[string]string{
			"token":    token,
			"password": "newsecret456",
		})
		res, err = http.Post(ts.URL+"/api/v1/auth/reset-password", "application/json", bytes.NewBuffer(resetBody))
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()

		if res.StatusCode != http.StatusOK {
			t.Fatalf("reset-password expected 200, got %d", res.StatusCode)
		}

		var resp map[string]any
		if err := json.NewDecoder(res.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		msg, _ := resp["message"].(string)
		if msg != "Your password has been reset. You can now log in." {
			t.Errorf("unexpected message: %v", msg)
		}

		loginOldBody := []byte(`{"email": "reset@test.com", "password": "secret123"}`)
		loginRes, _ := http.Post(ts.URL+"/api/v1/auth/login", "application/json", bytes.NewBuffer(loginOldBody))
		loginRes.Body.Close()
		if loginRes.StatusCode != http.StatusUnauthorized {
			t.Errorf("old password should no longer work, got %d", loginRes.StatusCode)
		}

		loginNewBody := []byte(`{"email": "reset@test.com", "password": "newsecret456"}`)
		loginRes, _ = http.Post(ts.URL+"/api/v1/auth/login", "application/json", bytes.NewBuffer(loginNewBody))
		loginRes.Body.Close()
		if loginRes.StatusCode != http.StatusOK {
			t.Errorf("new password should work, got %d", loginRes.StatusCode)
		}
	})

	t.Run("reset password with invalid token returns 400", func(t *testing.T) {
		defer testModule.AuthRepo.Reset()

		body := []byte(`{"token": "totally-fake-token", "password": "newsecret789"}`)
		res, err := http.Post(ts.URL+"/api/v1/auth/reset-password", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()

		if res.StatusCode != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", res.StatusCode)
		}

		respBody, _ := io.ReadAll(res.Body)
		if !bytes.Contains(respBody, []byte("invalid or expired reset token")) {
			t.Errorf("expected reset token error, got: %s", string(respBody))
		}
	})

	t.Run("reset password token is single-use", func(t *testing.T) {
		defer testModule.AuthRepo.Reset()
		defer testModule.MailRepo.Reset()

		registerUser(t, ts, "singleuse@test.com")

		forgotBody := []byte(`{"email": "singleuse@test.com"}`)
		res, err := http.Post(ts.URL+"/api/v1/auth/forgot-password", "application/json", bytes.NewBuffer(forgotBody))
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()

		token := testModule.MailRepo.LastResetToken()
		if token == "" {
			t.Fatal("expected non-empty token from fake mail")
		}

		resetBody, _ := json.Marshal(map[string]string{
			"token":    token,
			"password": "newpass111",
		})
		res, err = http.Post(ts.URL+"/api/v1/auth/reset-password", "application/json", bytes.NewBuffer(resetBody))
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()

		if res.StatusCode != http.StatusOK {
			t.Fatalf("first reset-password expected 200, got %d", res.StatusCode)
		}

		res, err = http.Post(ts.URL+"/api/v1/auth/reset-password", "application/json", bytes.NewBuffer(resetBody))
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()

		if res.StatusCode != http.StatusBadRequest {
			t.Errorf("reused token should return 400, got %d", res.StatusCode)
		}
	})

	t.Run("reset password with missing fields returns 400", func(t *testing.T) {
		defer testModule.AuthRepo.Reset()

		body := []byte(`{"token": "some-token"}`)
		res, err := http.Post(ts.URL+"/api/v1/auth/reset-password", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()

		if res.StatusCode != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", res.StatusCode)
		}
	})

	testModule.AuthRepo.Reset()
	testModule.MailRepo.Reset()
}

func TestMe(t *testing.T) {
	router := chi.NewRouter()
	testModule := module.NewTestModule()

	server := app.NewServer(router, testModule)
	r := server.Init()

	ts := httptest.NewServer(r)
	defer ts.Close()

	t.Run("me returns user profile with 200", func(t *testing.T) {
		defer testModule.AuthRepo.Reset()

		token, userID := registerUser(t, ts, "me@test.com")

		res := authenticatedRequest(t, ts, "GET", "/api/v1/auth/me", token, nil)
		defer res.Body.Close()

		if res.StatusCode != http.StatusOK {
			t.Fatalf("expected 200, got %d", res.StatusCode)
		}

		var resp map[string]any
		if err := json.NewDecoder(res.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if resp["id"] != userID {
			t.Errorf("expected id %s, got %v", userID, resp["id"])
		}
		if resp["email"] != "me@test.com" {
			t.Errorf("expected email me@test.com, got %v", resp["email"])
		}
		for _, key := range []string{"roles", "permissions", "plan", "quotas"} {
			if _, ok := resp[key]; !ok {
				t.Errorf("response missing key %q", key)
			}
		}
	})

	t.Run("me without token returns 401", func(t *testing.T) {
		defer testModule.AuthRepo.Reset()

		res := authenticatedRequest(t, ts, "GET", "/api/v1/auth/me", "", nil)
		defer res.Body.Close()

		if res.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", res.StatusCode)
		}
	})

	testModule.AuthRepo.Reset()
}

func TestLogout(t *testing.T) {
	router := chi.NewRouter()
	testModule := module.NewTestModule()

	server := app.NewServer(router, testModule)
	r := server.Init()

	ts := httptest.NewServer(r)
	defer ts.Close()

	t.Run("logout clears refresh token", func(t *testing.T) {
		defer testModule.AuthRepo.Reset()

		token, _ := registerUser(t, ts, "logout@test.com")

		var loginResp map[string]any
		loginBody := []byte(`{"email": "logout@test.com", "password": "secret123"}`)
		loginRes, err := http.Post(ts.URL+"/api/v1/auth/login", "application/json", bytes.NewBuffer(loginBody))
		if err != nil {
			t.Fatal(err)
		}
		json.NewDecoder(loginRes.Body).Decode(&loginResp)
		loginRes.Body.Close()
		oldRefreshToken, _ := loginResp["refreshToken"].(string)

		res := authenticatedRequest(t, ts, "POST", "/api/v1/auth/logout", token, nil)
		defer res.Body.Close()

		if res.StatusCode != http.StatusOK {
			t.Fatalf("expected 200, got %d", res.StatusCode)
		}

		var resp map[string]any
		if err := json.NewDecoder(res.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if resp["message"] != "Signed out successfully." {
			t.Errorf("unexpected message: %v", resp["message"])
		}

		refreshBody := []byte(`{"token": "` + oldRefreshToken + `"}`)
		refreshRes, err := http.Post(ts.URL+"/api/v1/auth/refresh", "application/json", bytes.NewBuffer(refreshBody))
		if err != nil {
			t.Fatal(err)
		}
		defer refreshRes.Body.Close()

		if refreshRes.StatusCode != http.StatusUnauthorized {
			t.Errorf("refresh after logout expected 401, got %d", refreshRes.StatusCode)
		}
	})

	t.Run("logout without token returns 401", func(t *testing.T) {
		defer testModule.AuthRepo.Reset()

		res := authenticatedRequest(t, ts, "POST", "/api/v1/auth/logout", "", nil)
		defer res.Body.Close()

		if res.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", res.StatusCode)
		}
	})

	testModule.AuthRepo.Reset()
}

func TestRefresh(t *testing.T) {
	router := chi.NewRouter()
	testModule := module.NewTestModule()

	server := app.NewServer(router, testModule)
	r := server.Init()

	ts := httptest.NewServer(r)
	defer ts.Close()

	registerUser(t, ts, "refresh@test.com")

	loginBody := []byte(`{"email": "refresh@test.com", "password": "secret123"}`)
	loginRes, err := http.Post(ts.URL+"/api/v1/auth/login", "application/json", bytes.NewBuffer(loginBody))
	if err != nil {
		t.Fatal(err)
	}
	var loginResp map[string]any
	json.NewDecoder(loginRes.Body).Decode(&loginResp)
	loginRes.Body.Close()
	oldRefreshToken, _ := loginResp["refreshToken"].(string)

	t.Run("refresh returns new token pair with 200", func(t *testing.T) {
		defer testModule.AuthRepo.Reset()

		body := []byte(`{"token": "` + oldRefreshToken + `"}`)
		res, err := http.Post(ts.URL+"/api/v1/auth/refresh", "application/json", bytes.NewBuffer(body))
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

		newAccess, _ := resp["accessToken"].(string)
		newRefresh, _ := resp["refreshToken"].(string)

		if newAccess == "" || newRefresh == "" {
			t.Fatal("expected non-empty accessToken and refreshToken")
		}
		if newAccess == oldRefreshToken {
			t.Error("access token should not equal refresh token")
		}
	})

	t.Run("refresh with invalid token returns 401", func(t *testing.T) {
		body := []byte(`{"token": "bogus-refresh-token"}`)
		res, err := http.Post(ts.URL+"/api/v1/auth/refresh", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()

		if res.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", res.StatusCode)
		}
	})

	t.Run("refresh with missing body returns 400", func(t *testing.T) {
		body := []byte(`{}`)
		res, err := http.Post(ts.URL+"/api/v1/auth/refresh", "application/json", bytes.NewBuffer(body))
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()

		if res.StatusCode != http.StatusBadRequest {
			t.Errorf("expected 400, got %d", res.StatusCode)
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

		_, err := testModule.Enforcer.AddPolicy(userID, "/api/v1/auth/demo", "POST")
		if err != nil {
			t.Fatal(err)
		}

		res := authenticatedRequest(t, ts, "POST", "/api/v1/auth/demo", token, nil)
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
		testModule.LimitGuardRepo.AddPermissionLimitStr(pkgID, "/api/v1/auth/demo", "POST", limit)

		_, err := testModule.Enforcer.AddPolicy(userID, "/api/v1/auth/demo", "POST")
		if err != nil {
			t.Fatal(err)
		}

		for i := 0; i < limit; i++ {
			res := authenticatedRequest(t, ts, "POST", "/api/v1/auth/demo", token, nil)
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
		testModule.LimitGuardRepo.AddPermissionLimitStr(pkgID, "/api/v1/auth/demo", "POST", limit)

		_, err := testModule.Enforcer.AddPolicy(userID, "/api/v1/auth/demo", "POST")
		if err != nil {
			t.Fatal(err)
		}

		// Consume the limit
		for i := 0; i < int(limit); i++ {
			res := authenticatedRequest(t, ts, "POST", "/api/v1/auth/demo", token, nil)
			res.Body.Close()

			if res.StatusCode != http.StatusOK {
				t.Fatalf("expected 200 on attempt %d, got %d", i+1, res.StatusCode)
			}
		}

		// Next should be 403
		res := authenticatedRequest(t, ts, "POST", "/api/v1/auth/demo", token, nil)
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
		testModule.LimitGuardRepo.AddPermissionLimitStr(pkgID, "/api/v1/auth/demo", "POST", limit)

		_, err := testModule.Enforcer.AddPolicy(userID, "/api/v1/auth/demo", "POST")
		if err != nil {
			t.Fatal(err)
		}
		_, err = testModule.Enforcer.AddPolicy(userID, "/api/v1/auth/demo", "DELETE")
		if err != nil {
			t.Fatal(err)
		}

		// POST 3 times → used = 3
		for i := 0; i < 3; i++ {
			res := authenticatedRequest(t, ts, "POST", "/api/v1/auth/demo", token, nil)
			res.Body.Close()
			if res.StatusCode != http.StatusOK {
				t.Fatalf("POST attempt %d: expected 200, got %d", i+1, res.StatusCode)
			}
		}

		// DELETE 2 times → used = 1
		for i := 0; i < 2; i++ {
			res := authenticatedRequest(t, ts, "DELETE", "/api/v1/auth/demo", token, nil)
			res.Body.Close()
			if res.StatusCode != http.StatusOK {
				t.Fatalf("DELETE attempt %d: expected 200, got %d", i+1, res.StatusCode)
			}
		}

		// POST 3 more times → first 2 succeed, 3rd should 403
		for i := 0; i < 2; i++ {
			res := authenticatedRequest(t, ts, "POST", "/api/v1/auth/demo", token, nil)
			res.Body.Close()
			if res.StatusCode != http.StatusOK {
				t.Errorf("POST after decrement attempt %d: expected 200, got %d", i+1, res.StatusCode)
			}
		}

		res := authenticatedRequest(t, ts, "POST", "/api/v1/auth/demo", token, nil)
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
		testModule.LimitGuardRepo.AddPermissionLimitStr(pkgID, "/api/v1/auth/demo", "POST", -1)

		_, err := testModule.Enforcer.AddPolicy(userID, "/api/v1/auth/demo", "POST")
		if err != nil {
			t.Fatal(err)
		}

		for i := 0; i < 10; i++ {
			res := authenticatedRequest(t, ts, "POST", "/api/v1/auth/demo", token, nil)
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
		testModule.LimitGuardRepo.AddPermissionLimitStr(pkgID, "/api/v1/auth/demo", "GET", 0)

		_, err := testModule.Enforcer.AddPolicy(userID, "/api/v1/auth/demo", "GET")
		if err != nil {
			t.Fatal(err)
		}

		res := authenticatedRequest(t, ts, "GET", "/api/v1/auth/demo", token, nil)
		defer res.Body.Close()

		if res.StatusCode != http.StatusOK {
			t.Errorf("expected 200, got %d", res.StatusCode)
		}
	})
}
