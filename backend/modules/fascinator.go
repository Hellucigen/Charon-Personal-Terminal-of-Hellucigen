// Package modules — Fascinator integration.
//
// This service wraps the Fascinator Flask backend (the Python repo whose
// app.py is bundled with this project). It can:
//   - Start / stop the Fascinator process (one-click launch)
//   - Detect runtime status, follow logs
//   - Edit the YAML/JSON config in-place from the UI
//   - Proxy /api/* calls so the frontend doesn't deal with CORS or process URLs
package modules

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"personal-terminal/backend/core"
)

type FascinatorService struct {
	mu       sync.Mutex
	cmd      *exec.Cmd
	cancel   context.CancelFunc
	logBuf   *ringBuffer
	procPath string // python executable
	appPath  string // path to app.py
	cfgPath  string // path to config.json / config.yaml (optional)
	port     int
}

func NewFascinatorService() *FascinatorService {
	return &FascinatorService{
		logBuf: newRingBuffer(4096),
		port:   5000,
	}
}

// ──────────────────────────────────────────────────────────────────────
// Process control
// ──────────────────────────────────────────────────────────────────────

// Configure sets where the Fascinator code lives and which python to use.
func (s *FascinatorService) Configure(pythonPath, appPath string, port int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if pythonPath == "" {
		pythonPath = defaultPython()
	}
	if _, err := os.Stat(appPath); err != nil {
		return fmt.Errorf("fascinator app.py not found at %s: %w", appPath, err)
	}
	s.procPath = pythonPath
	s.appPath = appPath
	if port > 0 {
		s.port = port
	}
	return nil
}

func (s *FascinatorService) Start() error {
	s.mu.Lock()

	// Fall back to the persisted config when this instance was never
	// explicitly configured (e.g. frontend calls Start right after launch).
	if s.procPath == "" || s.appPath == "" {
		if cfg := core.GlobalConfig; cfg != nil && cfg.FascinatorApp != "" {
			s.procPath = cfg.FascinatorPython
			s.appPath = cfg.FascinatorApp
			if cfg.FascinatorConfig != "" {
				s.cfgPath = cfg.FascinatorConfig
			}
			if cfg.FascinatorPort > 0 {
				s.port = cfg.FascinatorPort
			}
		}
	}
	if s.appPath == "" {
		s.mu.Unlock()
		return errors.New("fascinator not configured: set the python and app.py paths in Settings")
	}
	if s.procPath == "" {
		s.procPath = defaultPython()
	}

	if s.cmd != nil && s.cmd.Process != nil {
		s.mu.Unlock()
		return errors.New("fascinator already running")
	}

	if _, err := os.Stat(s.appPath); err != nil {
		s.mu.Unlock()
		return fmt.Errorf("app.py not found at %s: %w", s.appPath, err)
	}
	s.mu.Unlock()

	ctx, cancel := context.WithCancel(context.Background())
	s.mu.Lock()
	s.cancel = cancel
	s.mu.Unlock()

	cmd := exec.CommandContext(ctx, s.procPath, s.appPath)
	cmd.Dir = filepath.Dir(s.appPath)
	cmd.Env = append(os.Environ(), fmt.Sprintf("PORT=%d", s.port))
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		return err
	}

	s.mu.Lock()
	s.cmd = cmd
	s.mu.Unlock()

	go s.tail(stdout)
	go s.tail(stderr)
	go func() {
		_ = cmd.Wait()
		s.mu.Lock()
		s.cmd = nil
		s.mu.Unlock()
		if core.GlobalBus != nil {
			core.GlobalBus.Publish("fascinator.exited", nil)
		}
	}()

	if core.GlobalBus != nil {
		core.GlobalBus.Publish("fascinator.started", map[string]interface{}{"port": s.port})
	}
	return nil
}

func (s *FascinatorService) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cmd == nil || s.cmd.Process == nil {
		return errors.New("fascinator not running")
	}
	if s.cancel != nil {
		s.cancel()
	}
	_ = s.cmd.Process.Kill()
	s.cmd = nil
	return nil
}

func (s *FascinatorService) Restart() error {
	_ = s.Stop()
	time.Sleep(400 * time.Millisecond)
	return s.Start()
}

// Status returns the live state of the process and a recent log slice.
func (s *FascinatorService) Status() map[string]interface{} {
	s.mu.Lock()
	running := s.cmd != nil && s.cmd.Process != nil
	pid := 0
	if running {
		pid = s.cmd.Process.Pid
	}
	s.mu.Unlock()

	healthy := false
	if running {
		healthy = s.ping()
	}

	return map[string]interface{}{
		"running": running,
		"pid":     pid,
		"port":    s.port,
		"healthy": healthy,
		"ping":    healthy,
		"url":     fmt.Sprintf("http://127.0.0.1:%d", s.port),
		"logs":    s.logBuf.Snapshot(),
	}
}

func (s *FascinatorService) ping() bool {
	c := http.Client{Timeout: 600 * time.Millisecond}
	r, err := c.Get(fmt.Sprintf("http://127.0.0.1:%d/api/graph", s.port))
	if err != nil {
		return false
	}
	defer r.Body.Close()
	return r.StatusCode == 200
}

func (s *FascinatorService) tail(r io.Reader) {
	buf := make([]byte, 1024)
	for {
		n, err := r.Read(buf)
		if n > 0 {
			s.logBuf.Append(string(buf[:n]))
			if core.GlobalBus != nil {
				core.GlobalBus.Publish("fascinator.log", map[string]interface{}{
					"chunk": string(buf[:n]),
				})
			}
		}
		if err != nil {
			return
		}
	}
}

// ──────────────────────────────────────────────────────────────────────
// REST proxy — surface every Fascinator endpoint at one cost.
// ──────────────────────────────────────────────────────────────────────

func (s *FascinatorService) Call(method, path string, payload map[string]interface{}) (map[string]interface{}, error) {
	url := fmt.Sprintf("http://127.0.0.1:%d%s", s.port, path)
	var body io.Reader
	if payload != nil {
		b, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		body = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	c := http.Client{Timeout: 8 * time.Second}
	resp, err := c.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)

	out := map[string]interface{}{}
	if len(raw) == 0 {
		return out, nil
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		var arr []interface{}
		if err2 := json.Unmarshal(raw, &arr); err2 == nil {
			return map[string]interface{}{"items": arr}, nil
		}
		return nil, fmt.Errorf("fascinator %s %s: %w", method, path, err)
	}
	if resp.StatusCode >= 400 {
		return out, fmt.Errorf("fascinator %s %s status=%d", method, path, resp.StatusCode)
	}
	return out, nil
}

func (s *FascinatorService) SendNLP(text string) (map[string]interface{}, error) {
	return s.Call("POST", "/api/nlp", map[string]interface{}{"text": text})
}

func (s *FascinatorService) SetConfigPath(path string) {
	s.mu.Lock()
	s.cfgPath = path
	s.mu.Unlock()
}

func (s *FascinatorService) ReadConfig() (string, error) {
	s.mu.Lock()
	if s.cfgPath == "" && core.GlobalConfig != nil {
		s.cfgPath = core.GlobalConfig.FascinatorConfig
	}
	p := s.cfgPath
	s.mu.Unlock()
	if p != "" {
		if b, err := os.ReadFile(p); err == nil {
			return string(b), nil
		}
	}
	cfg, err := s.Call("GET", "/api/config", nil)
	if err != nil {
		return "", err
	}
	b, _ := json.MarshalIndent(cfg, "", "  ")
	return string(b), nil
}

func (s *FascinatorService) WriteConfig(content string) error {
	s.mu.Lock()
	if s.cfgPath == "" && core.GlobalConfig != nil {
		s.cfgPath = core.GlobalConfig.FascinatorConfig
	}
	p := s.cfgPath
	s.mu.Unlock()
	if p != "" {
		return os.WriteFile(p, []byte(content), 0o644)
	}
	var payload map[string]interface{}
	if err := json.Unmarshal([]byte(content), &payload); err != nil {
		return fmt.Errorf("config must be valid JSON when no file path is configured: %w", err)
	}
	_, err := s.Call("PUT", "/api/config", payload)
	return err
}

func (s *FascinatorService) Logs() []string {
	raw := s.logBuf.Snapshot()
	if raw == "" {
		return []string{}
	}
	lines := []string{}
	cur := ""
	for _, c := range raw {
		if c == '\n' {
			lines = append(lines, cur)
			cur = ""
		} else {
			cur += string(c)
		}
	}
	if cur != "" {
		lines = append(lines, cur)
	}
	return lines
}

func (s *FascinatorService) TopK() (map[string]interface{}, error) {
	return s.Call("GET", "/api/topk", nil)
}

func (s *FascinatorService) ActionQueue() (map[string]interface{}, error) {
	return s.Call("GET", "/api/actions/queue", nil)
}

func (s *FascinatorService) ExecuteAction(nodeID string) (map[string]interface{}, error) {
	return s.Call("POST", "/api/actions/execute", map[string]interface{}{"node_id": nodeID})
}

func defaultPython() string {
	for _, c := range []string{"python3", "python", "py"} {
		if p, err := exec.LookPath(c); err == nil {
			return p
		}
	}
	return "python"
}

type ringBuffer struct {
	mu  sync.Mutex
	buf []byte
	cap int
}

func newRingBuffer(cap int) *ringBuffer { return &ringBuffer{cap: cap} }

func (r *ringBuffer) Append(s string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.buf = append(r.buf, s...)
	if len(r.buf) > r.cap {
		r.buf = r.buf[len(r.buf)-r.cap:]
	}
}

func (r *ringBuffer) Snapshot() string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return string(r.buf)
}