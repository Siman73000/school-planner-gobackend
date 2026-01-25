package api_utils

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

//
// =====================
// Public Interface
// =====================
//

type KV interface {
	GetString(ctx context.Context, key string) (string, bool, error)
	SetBody(ctx context.Context, key string, value []byte) error
	Ping(ctx context.Context) error
}

//
// =====================
// Factory (auto-detect)
// =====================
//

func NewKVFromEnv() (KV, error) {
	// Prefer native Redis if available
	if hasRedisEnv() {
		return newRedisKV()
	}

	// Fallback to Upstash REST
	if hasUpstashEnv() {
		return newUpstashKV()
	}

	return nil, errors.New("no Redis or Upstash environment variables found")
}

func hasRedisEnv() bool {
	return os.Getenv("REDIS_URL") != "" ||
		(os.Getenv("REDIS_HOST") != "" && os.Getenv("REDIS_PORT") != "")
}

func hasUpstashEnv() bool {
	return os.Getenv("UPSTASH_REDIS_REST_URL") != "" &&
		os.Getenv("UPSTASH_REDIS_REST_TOKEN") != ""
}

//
// =====================
// Redis (native TCP/TLS)
// =====================
//

type RedisKV struct {
	client *redis.Client
}

func newRedisKV() (*RedisKV, error) {
	if url := strings.TrimSpace(os.Getenv("REDIS_URL")); url != "" {
		opts, err := redis.ParseURL(url)
		if err != nil {
			return nil, err
		}

		opts.DialTimeout = 5 * time.Second
		opts.ReadTimeout = 3 * time.Second
		opts.WriteTimeout = 3 * time.Second

		return &RedisKV{
			client: redis.NewClient(opts),
		}, nil
	}

	host := strings.TrimSpace(os.Getenv("REDIS_HOST"))
	port := strings.TrimSpace(os.Getenv("REDIS_PORT"))
	pass := strings.TrimSpace(os.Getenv("REDIS_PASSWORD"))

	if host == "" || port == "" {
		return nil, errors.New("missing REDIS_URL or REDIS_HOST/REDIS_PORT")
	}

	return &RedisKV{
		client: redis.NewClient(&redis.Options{
			Addr:        host + ":" + port,
			Password:    pass,
			DB:          0,
			DialTimeout: 5 * time.Second,
		}),
	}, nil
}

func (r *RedisKV) GetString(ctx context.Context, key string) (string, bool, error) {
	val, err := r.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return val, true, nil
}

func (r *RedisKV) SetBody(ctx context.Context, key string, value []byte) error {
	return r.client.Set(ctx, key, value, 0).Err()
}

func (r *RedisKV) Ping(ctx context.Context) error {
	return r.client.Ping(ctx).Err()
}

//
// =====================
// Upstash (REST)
// =====================
//

type UpstashKV struct {
	baseURL string
	token   string
	http    *http.Client
}

func newUpstashKV() (*UpstashKV, error) {
	base := strings.TrimSpace(os.Getenv("UPSTASH_REDIS_REST_URL"))
	tok := strings.TrimSpace(os.Getenv("UPSTASH_REDIS_REST_TOKEN"))

	if base == "" || tok == "" {
		return nil, errors.New("missing UPSTASH_REDIS_REST_URL or TOKEN")
	}

	return &UpstashKV{
		baseURL: strings.TrimRight(base, "/"),
		token:   tok,
		http:    &http.Client{Timeout: 10 * time.Second},
	}, nil
}

type upstashResp struct {
	Result json.RawMessage `json:"result"`
	Error  string          `json:"error"`
}

func (u *UpstashKV) do(
	ctx context.Context,
	method, path string,
	body []byte,
	contentType string,
) (upstashResp, error) {
	req, err := http.NewRequestWithContext(
		ctx,
		method,
		u.baseURL+path,
		bytes.NewReader(body),
	)
	if err != nil {
		return upstashResp{}, err
	}

	req.Header.Set("Authorization", "Bearer "+u.token)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}

	res, err := u.http.Do(req)
	if err != nil {
		return upstashResp{}, err
	}
	defer res.Body.Close()

	b, _ := io.ReadAll(res.Body)

	var out upstashResp
	_ = json.Unmarshal(b, &out)

	if out.Error != "" {
		return out, fmt.Errorf("upstash error: %s", out.Error)
	}
	if res.StatusCode < 200 || res.StatusCode > 299 {
		return out, fmt.Errorf("upstash http %d", res.StatusCode)
	}

	return out, nil
}

func (u *UpstashKV) GetString(ctx context.Context, key string) (string, bool, error) {
	out, err := u.do(ctx, http.MethodGet, "/get/"+escapeKey(key), nil, "")
	if err != nil {
		return "", false, err
	}

	if string(out.Result) == "null" || len(out.Result) == 0 {
		return "", false, nil
	}

	var s string
	if err := json.Unmarshal(out.Result, &s); err != nil {
		return string(out.Result), true, nil
	}

	return s, true, nil
}

func (u *UpstashKV) SetBody(ctx context.Context, key string, value []byte) error {
	_, err := u.do(
		ctx,
		http.MethodPost,
		"/set/"+escapeKey(key),
		value,
		"text/plain; charset=utf-8",
	)
	return err
}

func (u *UpstashKV) Ping(ctx context.Context) error {
	_, err := u.do(ctx, http.MethodGet, "/ping", nil, "")
	return err
}

//
// =====================
// Utilities
// =====================
//

func escapeKey(k string) string {
	repl := strings.NewReplacer(
		"%", "%25",
		" ", "%20",
		":", "%3A",
		"/", "%2F",
		"?", "%3F",
		"#", "%23",
	)
	return repl.Replace(k)
}
