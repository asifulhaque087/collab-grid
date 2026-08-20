package util

import (
	"encoding/json"
	"io"
	"net/http"
)

func WriteJson(w http.ResponseWriter, status int, data any) error {

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	return json.NewEncoder(w).Encode(data)
}

func ReadResponse(body io.ReadCloser) []byte {
	respBody, _ := io.ReadAll(body)
	body.Close()
	return respBody
}
