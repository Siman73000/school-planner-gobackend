package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/Siman73000/workorschool-planner/api_utils"
)

func Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	kv, err := api_utils.NewKVFromEnv()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":     false,
			"error":  "kv init failed",
			"detail": err.Error(),
			"time":   time.Now().UTC().Format(time.RFC3339Nano),
		})
		return
	}

	if err := kv.Ping(r.Context()); err != nil {
		w.WriteHeader(http.StatusBadGateway)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":     false,
			"error":  "kv unreachable",
			"detail": err.Error(),
			"time":   time.Now().UTC().Format(time.RFC3339Nano),
		})
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]any{
		"ok":        true,
		"kv":        "connected",
		"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
	})
}
