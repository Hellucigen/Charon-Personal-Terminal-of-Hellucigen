// Package modules — Notes service.
//
// The Notes table stores the document body as serialized JSON describing a
// tree of blocks (paragraph, heading, list, code, table, image, audio,
// video, file, embed, toggle, divider). The shape of the JSON is the
// frontend's concern; this service only persists, searches, and links.
package modules

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"personal-terminal/backend/core"
	"personal-terminal/backend/db"
)

type Note struct {
	ID        string   `json:"id"`
	Title     string   `json:"title"`
	Template  string   `json:"template"` // blank|dream|game|weapon|book|...
	Body      string   `json:"body"`     // serialized block tree
	Tags      []string `json:"tags"`
	ParentID  string   `json:"parent_id,omitempty"`
	CreatedAt int64    `json:"created_at"`
	UpdatedAt int64    `json:"updated_at"`
}

type NotesService struct{}

func NewNotesService() *NotesService { return &NotesService{} }

func (s *NotesService) store() *db.Store { return core.GlobalStore.(*db.Store) }

// Create persists a new note and returns the full row including its
// generated id and timestamps.
func (s *NotesService) Create(n Note) (*Note, error) {
	if n.Template == "" {
		n.Template = "blank"
	}
	if n.Tags == nil {
		n.Tags = []string{}
	}
	n.ID = newID("n_")
	n.CreatedAt = time.Now().Unix()
	n.UpdatedAt = n.CreatedAt
	tags, _ := json.Marshal(n.Tags)
	_, err := s.store().DB.Exec(
		`INSERT INTO notes(id,title,template,body,tags,parent_id,created_at,updated_at)
		 VALUES(?,?,?,?,?,?,?,?)`,
		n.ID, n.Title, n.Template, n.Body, string(tags), nullableStr(n.ParentID),
		n.CreatedAt, n.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	s.indexFTS(&n)
	core.GlobalBus.Publish("notes.created", map[string]interface{}{"id": n.ID})
	return &n, nil
}

func (s *NotesService) Update(n Note) error {
	n.UpdatedAt = time.Now().Unix()
	tags, _ := json.Marshal(n.Tags)
	_, err := s.store().DB.Exec(
		`UPDATE notes SET title=?,template=?,body=?,tags=?,parent_id=?,updated_at=? WHERE id=?`,
		n.Title, n.Template, n.Body, string(tags), nullableStr(n.ParentID), n.UpdatedAt, n.ID,
	)
	if err == nil {
		s.indexFTS(&n)
		core.GlobalBus.Publish("notes.updated", map[string]interface{}{"id": n.ID})
	}
	return err
}

func (s *NotesService) Delete(id string) error {
	_, err := s.store().DB.Exec(`DELETE FROM notes WHERE id=?`, id)
	if err == nil {
		core.GlobalBus.Publish("notes.deleted", map[string]interface{}{"id": id})
	}
	return err
}

func (s *NotesService) Get(id string) (*Note, error) {
	rows, err := s.store().DB.Query(`SELECT id,title,template,body,tags,
		COALESCE(parent_id,''),created_at,updated_at FROM notes WHERE id=?`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if !rows.Next() {
		return nil, errors.New("note not found")
	}
	return scanNote(rows)
}

// List returns notes optionally filtered by template (e.g. "dream", "game").
// Empty template returns everything.
func (s *NotesService) List(template string, limit int) ([]Note, error) {
	if limit <= 0 || limit > 500 {
		limit = 200
	}
	q := `SELECT id,title,template,body,tags,COALESCE(parent_id,''),created_at,updated_at FROM notes`
	args := []any{}
	if template != "" {
		q += ` WHERE template=?`
		args = append(args, template)
	}
	q += ` ORDER BY updated_at DESC LIMIT ?`
	args = append(args, limit)

	rows, err := s.store().DB.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Note{}
	for rows.Next() {
		n, err := scanNote(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *n)
	}
	return out, nil
}

// Search hits the FTS5 virtual table for case-insensitive matches across
// title, body, and tags.
func (s *NotesService) Search(query string) ([]Note, error) {
	if strings.TrimSpace(query) == "" {
		return []Note{}, nil
	}
	rows, err := s.store().DB.Query(`SELECT n.id,n.title,n.template,n.body,n.tags,
		COALESCE(n.parent_id,''),n.created_at,n.updated_at
		FROM notes_fts f JOIN notes n ON n.rowid=f.rowid
		WHERE notes_fts MATCH ? ORDER BY rank LIMIT 100`, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Note{}
	for rows.Next() {
		n, err := scanNote(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *n)
	}
	return out, nil
}

// Backlinks finds notes that mention the given title via the [[wiki-link]] syntax.
func (s *NotesService) Backlinks(title string) ([]Note, error) {
	needle := "[[" + title + "]]"
	rows, err := s.store().DB.Query(`SELECT id,title,template,body,tags,
		COALESCE(parent_id,''),created_at,updated_at FROM notes WHERE body LIKE ?`,
		"%"+needle+"%")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Note{}
	for rows.Next() {
		n, err := scanNote(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *n)
	}
	return out, nil
}

func (s *NotesService) indexFTS(n *Note) {
	tags, _ := json.Marshal(n.Tags)
	_, _ = s.store().DB.Exec(`INSERT OR REPLACE INTO notes_fts(rowid,id,title,body,tags)
		SELECT rowid,?,?,?,? FROM notes WHERE id=?`,
		n.ID, n.Title, n.Body, string(tags), n.ID)
}

// ──────────────────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────────────────

func scanNote(rows *sql.Rows) (*Note, error) {
	var n Note
	var tagsRaw string
	if err := rows.Scan(&n.ID, &n.Title, &n.Template, &n.Body, &tagsRaw,
		&n.ParentID, &n.CreatedAt, &n.UpdatedAt); err != nil {
		return nil, err
	}
	_ = json.Unmarshal([]byte(tagsRaw), &n.Tags)
	if n.Tags == nil {
		n.Tags = []string{}
	}
	return &n, nil
}

func nullableStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func newID(prefix string) string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return prefix + hex.EncodeToString(b)
}
