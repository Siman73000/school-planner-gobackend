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
)

type UpstashClient struct {
	BaseURL string
	Token   string
	HTTP    *http.Client
}

func NewUpstashFromEnv() (*UpstashClient, error) {
	base := strings.TrimSpace(os.Getenv("UPSTASH_REDIS_REST_URL"))
	tok := strings.TrimSpace(os.Getenv("UPSTASH_REDIS_REST_TOKEN"))
	if base == "" || tok == "" {
		return nil, errors.New("missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN")
	}
	return &UpstashClient{
		BaseURL: strings.TrimRight(base, "/"),
		Token:   tok,
		HTTP:    &http.Client{Timeout: 10 * time.Second},
	}, nil
}

type upstashResp struct {
	Result json.RawMessage `json:"result"`
	Error  string          `json:"error"`
}

func (c *UpstashClient) do(ctx context.Context, method, path string, body []byte, contentType string) (upstashResp, int, error) {
	req, err := http.NewRequestWithContext(ctx, method, c.BaseURL+path, bytes.NewReader(body))
	if err != nil {
		return upstashResp{}, 0, err
	}
	req.Header.Set("Authorization", "Bearer "+c.Token)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}

	res, err := c.HTTP.Do(req)
	if err != nil {
		return upstashResp{}, 0, err
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)

	var out upstashResp
	_ = json.Unmarshal(b, &out)
	if out.Error != "" {
		return out, res.StatusCode, fmt.Errorf("upstash error: %s", out.Error)
	}
	if res.StatusCode < 200 || res.StatusCode > 299 {
		return out, res.StatusCode, fmt.Errorf("upstash http %d", res.StatusCode)
	}
	return out, res.StatusCode, nil
}

func (c *UpstashClient) GetString(ctx context.Context, key string) (string, bool, error) {
	out, _, err := c.do(ctx, http.MethodGet, "/get/"+escapeKey(key), nil, "")
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

func (c *UpstashClient) SetBody(ctx context.Context, key string, value []byte) error {
	_, _, err := c.do(ctx, http.MethodPost, "/set/"+escapeKey(key), value, "text/plain; charset=utf-8")
	return err
}

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
