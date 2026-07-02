package modules

import (
	"encoding/json"
	"time"

	"personal-terminal/backend/core"
	"personal-terminal/backend/db"
)

// Fleeting is the captured stream-of-thought entry. Tiny on purpose.
type Fleeting struct {
	ID         string   `json:"id"`
	Body       string   `json:"body"`
	Tags       []string `json:"tags"`
	MediaPath  string   `json:"media_path,omitempty"`
	PromotedTo string   `json:"promoted_to,omitempty"` // note id once upgraded
	CreatedAt  int64    `json:"created_at"`
}

type FleetingService struct{}

func NewFleetingService() *FleetingService     { return &FleetingService{} }
func (s *FleetingService) store() *db.Store    { return core.GlobalStore.(*db.Store) }

// Capture is the hot-path call invoked by the global hotkey. Keep it cheap.
func (s *FleetingService) Capture(body string, tags []string, mediaPath string) (*Fleeting, error) {
	if tags == nil {
		tags = []string{}
	}
	f := Fleeting{
		ID:        newID("f_"),
		Body:      body,
		Tags:      tags,
		MediaPath: mediaPath,
		CreatedAt: time.Now().Unix(),
	}
	tagsJSON, _ := json.Marshal(f.Tags)
	_, err := s.store().DB.Exec(
		`INSERT INTO fleeting(id,body,tags,media_path,created_at) VALUES(?,?,?,?,?)`,
		f.ID, f.Body, string(tagsJSON), nullableStr(f.MediaPath), f.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	core.GlobalBus.Publish("fleeting.captured", map[string]interface{}{"id": f.ID})
	return &f, nil
}

// Stream returns the waterfall view ordered newest-first.
func (s *FleetingService) Stream(limit int) ([]Fleeting, error) {
	if limit <= 0 || limit > 1000 {
		limit = 200
	}
	rows, err := s.store().DB.Query(
		`SELECT id,body,tags,COALESCE(media_path,''),COALESCE(promoted_to,''),created_at
		FROM fleeting ORDER BY created_at DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Fleeting{}
	for rows.Next() {
		var f Fleeting
		var tagsRaw string
		if err := rows.Scan(&f.ID, &f.Body, &tagsRaw, &f.MediaPath, &f.PromotedTo, &f.CreatedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal([]byte(tagsRaw), &f.Tags)
		if f.Tags == nil {
			f.Tags = []string{}
		}
		out = append(out, f)
	}
	return out, nil
}

func (s *FleetingService) Delete(id string) error {
	_, err := s.store().DB.Exec(`DELETE FROM fleeting WHERE id=?`, id)
	return err
}

// Promote converts a fleeting note into a regular Note with the given title.
// The fleeting row is kept but marked as promoted so it can be browsed later.
func (s *FleetingService) Promote(id, title, template string) (string, error) {
	var body string
	if err := s.store().DB.QueryRow(`SELECT body FROM fleeting WHERE id=?`, id).Scan(&body); err != nil {
		return "", err
	}
	if template == "" {
		template = "blank"
	}
	notesSvc := NewNotesService()
	n, err := notesSvc.Create(Note{Title: title, Template: template, Body: body, Tags: []string{"from-fleeting"}})
	if err != nil {
		return "", err
	}
	_, _ = s.store().DB.Exec(`UPDATE fleeting SET promoted_to=? WHERE id=?`, n.ID, id)
	return n.ID, nil
}
