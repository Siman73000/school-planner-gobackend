package upstash

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

type Client struct {
	BaseURL string
	Token   string
	HTTP    *http.Client
}

func NewFromEnv() (*Client, error) {
	base := strings.TrimSpace(os.Getenv("UPSTASH_REDIS_REST_URL"))
	tok := strings.TrimSpace(os.Getenv("UPSTASH_REDIS_REST_TOKEN"))
	if base == "" || tok == "" {
		return nil, errors.New("missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN")
	}
	return &Client{
		BaseURL: strings.TrimRight(base, "/"),
		Token:   tok,
		HTTP: &http.Client{
			Timeout: 10 * time.Second,
		},
	}, nil
}

type response struct {
	Result json.RawMessage `json:"result"`
	Error  string          `json:"error"`
}

func (c *Client) do(ctx context.Context, method, path string, body []byte, contentType string) (response, int, error) {
	req, err := http.NewRequestWithContext(ctx, method, c.BaseURL+path, bytes.NewReader(body))
	if err != nil {
		return response{}, 0, err
	}
	req.Header.Set("Authorization", "Bearer "+c.Token)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}

	res, err := c.HTTP.Do(req)
	if err != nil {
		return response{}, 0, err
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)

	var out response
	_ = json.Unmarshal(b, &out)
	if out.Error != "" {
		return out, res.StatusCode, fmt.Errorf("upstash error: %s", out.Error)
	}
	if res.StatusCode < 200 || res.StatusCode > 299 {
		return out, res.StatusCode, fmt.Errorf("upstash http %d", res.StatusCode)
	}
	return out, res.StatusCode, nil
}

func (c *Client) GetString(ctx context.Context, key string) (string, bool, error) {
	out, _, err := c.do(ctx, http.MethodGet, "/get/"+urlEscapeKey(key), nil, "")
	if err != nil {
		return "", false, err
	}
	if string(out.Result) == "null" || len(out.Result) == 0 {
		return "", false, nil
	}
	var s string
	if err := json.Unmarshal(out.Result, &s); err != nil {
		// If stored value isn't a JSON string, treat as raw
		return string(out.Result), true, nil
	}
	return s, true, nil
}

func (c *Client) SetValueBody(ctx context.Context, key string, value []byte) error {
	// Upstash supports: POST -d '$VALUE' REST_URL/set/<key>
	_, _, err := c.do(ctx, http.MethodPost, "/set/"+urlEscapeKey(key), value, "text/plain; charset=utf-8")
	return err
}

func urlEscapeKey(k string) string {
	// Conservative escaping for a few path-sensitive chars
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
