package handler

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"schoolplanner-vercel/internal/upstash"
)

type Settings struct {
	SemesterName string `json:"semesterName"`
	WeekStartsOn int    `json:"weekStartsOn"` // 0=Sunday, 1=Monday
}

type AppState struct {
	Version  int              `json:"version"`
	Courses  []map[string]any `json:"courses"`
	Tasks    []map[string]any `json:"tasks"`
	Grades   []map[string]any `json:"grades"`
	Settings Settings         `json:"settings"`
}

func defaultState() AppState {
	return AppState{
		Version: 1,
		Courses: []map[string]any{},
		Tasks:   []map[string]any{},
		Grades:  []map[string]any{},
		Settings: Settings{
			SemesterName: "Semester",
			WeekStartsOn: 1,
		},
	}
}

func State(w http.ResponseWriter, r *http.Request) {
	// Basic CORS for safety (same-origin is typical on Vercel)
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-API-Key")
	w.Header().Set("Access-Control-Allow-Methods", "GET, PUT, OPTIONS")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	// Optional API key
	apiKey := strings.TrimSpace(os.Getenv("PLANNER_API_KEY"))
	if apiKey != "" && r.Header.Get("X-API-Key") != apiKey {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "missing/invalid API key"})
		return
	}

	client, err := upstash.NewFromEnv()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{
			"error": "server misconfigured: " + err.Error(),
		})
		return
	}

	switch r.Method {
	case http.MethodGet:
		val, ok, err := client.GetString(r.Context(), "app_state")
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
			return
		}
		if !ok || strings.TrimSpace(val) == "" {
			writeJSON(w, http.StatusOK, defaultState())
			return
		}
		// Return raw JSON
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(val))
		return

	case http.MethodPut:
		body, err := readBodyLimit(r, 2<<20) // 2MB
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			return
		}

		// Validate it's JSON (and ensure it has version/settings)
		var st AppState
		if err := json.Unmarshal(body, &st); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid JSON"})
			return
		}
		if st.Version == 0 {
			st.Version = 1
		}
		// normalize
		if st.Settings.SemesterName == "" {
			st.Settings.SemesterName = "Semester"
		}
		if st.Settings.WeekStartsOn != 0 && st.Settings.WeekStartsOn != 1 {
			st.Settings.WeekStartsOn = 1
		}

		norm, _ := json.Marshal(st)
		if err := client.SetString(r.Context(), "app_state", string(norm)); err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
			return
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"ok":         true,
			"updated_at": time.Now().UTC().Format(time.RFC3339Nano),
		})
		return

	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func readBodyLimit(r *http.Request, max int64) ([]byte, error) {
	defer r.Body.Close()
	lr := io.LimitReader(r.Body, max+1)
	var buf bytes.Buffer
	if _, err := buf.ReadFrom(lr); err != nil {
		return nil, err
	}
	if int64(buf.Len()) > max {
		return nil, http.ErrBodyNotAllowed
	}
	return buf.Bytes(), nil
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
