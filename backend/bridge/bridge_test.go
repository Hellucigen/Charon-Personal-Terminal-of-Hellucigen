package bridge

import (
	"bytes"
	"encoding/json"
	"net/http"
	"path/filepath"
	"testing"
	"time"

	"personal-terminal/backend/core"
	"personal-terminal/backend/db"
)

// TestBridgeEndToEnd boots the reverse API against a temp database and
// exercises the auth guard plus a write path, the way Fascinator will.
func TestBridgeEndToEnd(t *testing.T) {
	store, err := db.Open(filepath.Join(t.TempDir(), "bridge.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer store.Close()
	if err := store.Migrate(); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	core.GlobalStore = store
	core.GlobalBus = core.NewEventBus()

	s := New(0, "test-token", nil)
	if err := s.Start(); err != nil {
		t.Fatalf("start: %v", err)
	}
	defer s.Stop()
	base := "http://" + s.Addr()

	// No token → 401.
	resp, err := http.Post(base+"/api/todos", "application/json", bytes.NewBufferString(`{"title":"x"}`))
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 without token, got %d", resp.StatusCode)
	}

	// With token → 201 todo.
	req, _ := http.NewRequest("POST", base+"/api/todos", bytes.NewBufferString(`{"title":"复习记忆节点","list":"today"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Charon-Token", "test-token")
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d", resp.StatusCode)
	}
	var out map[string]interface{}
	_ = json.NewDecoder(resp.Body).Decode(&out)
	if out["title"] != "复习记忆节点" {
		t.Fatalf("unexpected echo: %v", out)
	}

	// Health + summary smoke.
	hreq, _ := http.NewRequest("GET", base+"/health", nil)
	hreq.Header.Set("X-Charon-Token", "test-token")
	hresp, err := http.DefaultClient.Do(hreq)
	if err != nil || hresp.StatusCode != 200 {
		t.Fatalf("health: %v %v", err, hresp)
	}
	hresp.Body.Close()

	// Notify path (also covers the events route).
	nreq, _ := http.NewRequest("POST", base+"/api/notify", bytes.NewBufferString(`{"title":"FAS","message":"hi"}`))
	nreq.Header.Set("Content-Type", "application/json")
	nreq.Header.Set("X-Charon-Token", "test-token")
	nresp, err := http.DefaultClient.Do(nreq)
	if err != nil || nresp.StatusCode != 200 {
		t.Fatalf("notify: %v %v", err, nresp)
	}
	nresp.Body.Close()

	_ = time.Second
}
