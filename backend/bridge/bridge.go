// Package bridge — the reverse-control API.
//
// Charon is not just a frontend for Fascinator: it also serves a small
// localhost HTTP API so the Fascinator process (or any local tool) can
// write into Charon — create notes, capture fleeting thoughts, add todos,
// fire notifications and events. This is what lets Fascinator's action
// engine act on the terminal itself.
//
// Security: bound to 127.0.0.1 only; every request must carry the
// X-Charon-Token header matching config.bridge_token. The token is
// auto-generated on first start and printed to the log.
package bridge

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"io"
	"log"
	"net"
	"net/http"
	"strconv"
	"time"

	"personal-terminal/backend/core"
	"personal-terminal/backend/modules"
)

type Server struct {
	srv   *http.Server
	port  int
	token string
	emit  func(name string, data ...interface{}) // Wails EventsEmit wrapper
	addr  net.Addr
}

// EmitFn is how the app forwards bus events into the webview.
type EmitFn func(name string, data ...interface{})

func New(port int, token string, emit EmitFn) *Server {
	return &Server{port: port, token: token, emit: emit}
}

// EnsureToken returns the configured token, generating and persisting a
// fresh one on first use.
func EnsureToken(cfg *core.Config) string {
	if cfg.BridgeToken != "" {
		return cfg.BridgeToken
	}
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		cfg.BridgeToken = "charon-dev-token"
	} else {
		cfg.BridgeToken = hex.EncodeToString(b)
	}
	_ = cfg.Save()
	return cfg.BridgeToken
}

func (s *Server) Start() error {
	mux := http.NewServeMux()
	s.routes(mux)
	s.srv = &http.Server{
		Addr:        net.JoinHostPort("127.0.0.1", strconv.Itoa(s.port)),
		Handler:     s.auth(mux),
		ReadTimeout: 10 * time.Second,
	}
	ln, err := net.Listen("tcp", s.srv.Addr)
	if err != nil {
		return err
	}
	s.addr = ln.Addr()
	go func() {
		if err := s.srv.Serve(ln); err != nil && err != http.ErrServerClosed {
			log.Printf("bridge server: %v", err)
		}
	}()
	log.Printf("charon bridge listening on http://127.0.0.1:%d (token: %s...)", s.port, s.token[:4])
	core.GlobalBus.Publish("bridge.started", map[string]interface{}{"port": s.port})
	return nil
}

func (s *Server) Stop() {
	if s.srv != nil {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		_ = s.srv.Shutdown(ctx)
	}
}

// Addr returns the actual listening address (useful when port 0 was
// requested and the OS picked a free one).
func (s *Server) Addr() string {
	if s.addr == nil {
		return ""
	}
	return s.addr.String()
}

func (s *Server) auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Charon-Token") != s.token {
			writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"error": "invalid or missing X-Charon-Token"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func readBody(r *http.Request, v interface{}) error {
	defer r.Body.Close()
	return json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(v)
}

// routes wires every capability Fascinator may call. Keep the surface
// small and additive — this API crosses a process boundary.
func (s *Server) routes(mux *http.ServeMux) {
	notes := modules.NewNotesService()
	todo := modules.NewTodoService()
	fleeting := modules.NewFleetingService()
	health := modules.NewHealthService()
	finance := modules.NewFinanceService()
	diary := modules.NewDiaryService()
	detective := modules.NewDetectiveService()
	data := modules.NewDataService()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]interface{}{"ok": true, "app": "charon", "version": "0.2.0"})
	})

	mux.HandleFunc("POST /api/notes", func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Title   string   `json:"title"`
			Body    string   `json:"body"`
			Tags    []string `json:"tags"`
			Template string  `json:"template"`
		}
		if err := readBody(r, &in); err != nil {
			writeJSON(w, 400, map[string]interface{}{"error": err.Error()})
			return
		}
		if in.Template == "" {
			in.Template = "blank"
		}
		n, err := notes.Create(modules.Note{
			Title: in.Title, Body: in.Body, Tags: in.Tags, Template: in.Template,
		})
		if err != nil {
			writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
			return
		}
		s.forwardEvent("charon.note.created", map[string]interface{}{"title": in.Title})
		writeJSON(w, 201, n)
	})

	mux.HandleFunc("GET /api/notes/search", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("q")
		res, err := notes.Search(q)
		if err != nil {
			writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, 200, map[string]interface{}{"query": q, "results": res})
	})

	mux.HandleFunc("POST /api/todos", func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Title string `json:"title"`
			List  string `json:"list"`
			DueAt int64  `json:"due_at"`
			Important bool `json:"important"`
		}
		if err := readBody(r, &in); err != nil {
			writeJSON(w, 400, map[string]interface{}{"error": err.Error()})
			return
		}
		t, err := todo.Create(modules.Todo{
			Title: in.Title, List: in.List, DueAt: in.DueAt, Important: in.Important,
		})
		if err != nil {
			writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
			return
		}
		s.forwardEvent("charon.todo.created", map[string]interface{}{"title": in.Title})
		writeJSON(w, 201, t)
	})

	mux.HandleFunc("POST /api/fleeting", func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Body string   `json:"body"`
			Tags []string `json:"tags"`
		}
		if err := readBody(r, &in); err != nil {
			writeJSON(w, 400, map[string]interface{}{"error": err.Error()})
			return
		}
		f, err := fleeting.Capture(in.Body, in.Tags, "")
		if err != nil {
			writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
			return
		}
		s.forwardEvent("charon.fleeting.captured", map[string]interface{}{"body": in.Body})
		writeJSON(w, 201, f)
	})

	mux.HandleFunc("POST /api/health", func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Habit string  `json:"habit"`
			Value float64 `json:"value"`
			Unit  string  `json:"unit"`
			Note  string  `json:"note"`
		}
		if err := readBody(r, &in); err != nil {
			writeJSON(w, 400, map[string]interface{}{"error": err.Error()})
			return
		}
		l, err := health.Log(in.Habit, in.Value, in.Unit, in.Note)
		if err != nil {
			writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, 201, l)
	})

	mux.HandleFunc("POST /api/finance", func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Amount   float64 `json:"amount"`
			Category string  `json:"category"`
			Note     string  `json:"note"`
		}
		if err := readBody(r, &in); err != nil {
			writeJSON(w, 400, map[string]interface{}{"error": err.Error()})
			return
		}
		t, err := finance.SaveTransaction(modules.Transaction{
			Amount: in.Amount, Category: in.Category, Note: in.Note, Source: "fascinator",
		})
		if err != nil {
			writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, 201, t)
	})

	mux.HandleFunc("POST /api/diary", func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Line string `json:"line"`
			Mood int    `json:"mood"`
		}
		if err := readBody(r, &in); err != nil {
			writeJSON(w, 400, map[string]interface{}{"error": err.Error()})
			return
		}
		e, err := diary.Save(modules.DiaryEntry{Line: in.Line, Mood: in.Mood})
		if err != nil {
			writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, 201, e)
	})

	mux.HandleFunc("POST /api/detective/nodes", func(w http.ResponseWriter, r *http.Request) {
		var in modules.DetectiveNode
		if err := readBody(r, &in); err != nil {
			writeJSON(w, 400, map[string]interface{}{"error": err.Error()})
			return
		}
		n, err := detective.SaveNode(in)
		if err != nil {
			writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
			return
		}
		s.forwardEvent("charon.detective.node", map[string]interface{}{"label": in.Label})
		writeJSON(w, 201, n)
	})

	// Cross-module summary so Fascinator can ground answers in Charon data.
	mux.HandleFunc("GET /api/summary", func(w http.ResponseWriter, r *http.Request) {
		ov, err := data.Overview()
		if err != nil {
			writeJSON(w, 500, map[string]interface{}{"error": err.Error()})
			return
		}
		writeJSON(w, 200, ov)
	})

	// /api/events lets Fascinator push arbitrary events into the UI,
	// e.g. "fas.node.created" or "fas.action.executed".
	mux.HandleFunc("POST /api/events", func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Topic   string                 `json:"topic"`
			Payload map[string]interface{} `json:"payload"`
		}
		if err := readBody(r, &in); err != nil || in.Topic == "" {
			writeJSON(w, 400, map[string]interface{}{"error": "topic required"})
			return
		}
		s.forwardEvent(in.Topic, in.Payload)
		writeJSON(w, 200, map[string]interface{}{"ok": true})
	})

	// /api/notify shows a toast banner inside the terminal window.
	mux.HandleFunc("POST /api/notify", func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Title   string `json:"title"`
			Message string `json:"message"`
		}
		if err := readBody(r, &in); err != nil || in.Message == "" {
			writeJSON(w, 400, map[string]interface{}{"error": "message required"})
			return
		}
		if in.Title == "" {
			in.Title = "Fascinator"
		}
		s.forwardEvent("charon.notify", map[string]interface{}{"title": in.Title, "message": in.Message})
		writeJSON(w, 200, map[string]interface{}{"ok": true})
	})
}

// forwardEvent publishes on the internal bus and, when the window is up,
// re-emits it into the webview so React can react.
func (s *Server) forwardEvent(topic string, payload map[string]interface{}) {
	core.GlobalBus.Publish(topic, payload)
	if s.emit != nil {
		s.emit(topic, payload)
	}
}
