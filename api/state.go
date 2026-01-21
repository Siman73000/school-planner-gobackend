package handler

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/Siman73000/school-planner-gobackend/api_utils"
)

type AppState struct {
	Version  int              `json:"version"`
	Courses  []map[string]any `json:"courses"`
	Tasks    []map[string]any `json:"tasks"`
	Grades   []map[string]any `json:"grades"`
	Settings map[string]any   `json:"settings"`
}

func defaultState() AppState {
	return AppState{
		Version: 1,
		Courses: []map[string]any{},
		Tasks:   []map[string]any{},
		Grades:  []map[string]any{},
		Settings: map[string]any{
			"semesterName": "Semester",
			"weekStartsOn": 1,
			"theme":        "light",
			"defaultView":  "dashboard",
		},
	}
}

func State(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-API-Key")
	w.Header().Set("Access-Control-Allow-Methods", "GET, PUT, OPTIONS")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	apiKey := strings.TrimSpace(os.Getenv("PLANNER_API_KEY"))
	if apiKey != "" && r.Header.Get("X-API-Key") != apiKey {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "missing/invalid API key"})
		return
	}

	client, err := api_utils.NewUpstashFromEnv()
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
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(val))
		return

	case http.MethodPut:
		body, err := readBodyLimit(r, 2<<20)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "request too large"})
			return
		}

		var st AppState
		if err := json.Unmarshal(body, &st); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid JSON"})
			return
		}
		if st.Version == 0 {
			st.Version = 1
		}
		if st.Courses == nil {
			st.Courses = []map[string]any{}
		}
		if st.Tasks == nil {
			st.Tasks = []map[string]any{}
		}
		if st.Grades == nil {
			st.Grades = []map[string]any{}
		}
		if st.Settings == nil {
			st.Settings = map[string]any{}
		}

		// normalize known settings while preserving extra keys
		if _, ok := st.Settings["semesterName"]; !ok {
			st.Settings["semesterName"] = "Semester"
		}
		ws, ok := st.Settings["weekStartsOn"]
		if ok {
			f, isF := ws.(float64) // JSON numbers decode as float64
			if isF {
				if int(f) != 0 && int(f) != 1 {
					st.Settings["weekStartsOn"] = 1
				}
			} else {
				st.Settings["weekStartsOn"] = 1
			}
		} else {
			st.Settings["weekStartsOn"] = 1
		}
		if _, ok := st.Settings["theme"]; !ok {
			st.Settings["theme"] = "light"
		}
		if _, ok := st.Settings["defaultView"]; !ok {
			st.Settings["defaultView"] = "dashboard"
		}

		norm, _ := json.Marshal(st)
		if err := client.SetBody(r.Context(), "app_state", norm); err != nil {
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
