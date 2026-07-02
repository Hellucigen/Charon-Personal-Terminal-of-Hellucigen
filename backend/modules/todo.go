package modules

import (
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"personal-terminal/backend/core"
	"personal-terminal/backend/db"
)

type Todo struct {
	ID         string   `json:"id"`
	Title      string   `json:"title"`
	List       string   `json:"list"` // inbox | today | important | planned | <custom>
	DueAt      int64    `json:"due_at,omitempty"`
	ReminderAt int64    `json:"reminder_at,omitempty"`
	Repeat     string   `json:"repeat,omitempty"` // RRULE-ish: "daily" | "weekly:mon,wed" | "cron:..."
	Done       bool     `json:"done"`
	Important  bool     `json:"important"`
	Tags       []string `json:"tags"`
	Notes      string   `json:"notes"`
	ParentID   string   `json:"parent_id,omitempty"`
	CreatedAt  int64    `json:"created_at"`
	UpdatedAt  int64    `json:"updated_at"`
}

type TodoService struct{}

func NewTodoService() *TodoService { return &TodoService{} }
func (s *TodoService) store() *db.Store { return core.GlobalStore.(*db.Store) }

func (s *TodoService) Create(t Todo) (*Todo, error) {
	if t.List == "" {
		t.List = "inbox"
	}
	if t.Tags == nil {
		t.Tags = []string{}
	}
	t.ID = newID("t_")
	t.CreatedAt = time.Now().Unix()
	t.UpdatedAt = t.CreatedAt
	tags, _ := json.Marshal(t.Tags)
	_, err := s.store().DB.Exec(
		`INSERT INTO todos(id,title,list,due_at,reminder_at,repeat,done,important,tags,notes,parent_id,created_at,updated_at)
		 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		t.ID, t.Title, t.List, nullableI64(t.DueAt), nullableI64(t.ReminderAt),
		nullableStr(t.Repeat), boolToInt(t.Done), boolToInt(t.Important), string(tags),
		t.Notes, nullableStr(t.ParentID), t.CreatedAt, t.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	core.GlobalBus.Publish("todo.created", map[string]interface{}{"id": t.ID})
	return &t, nil
}

func (s *TodoService) Update(t Todo) error {
	t.UpdatedAt = time.Now().Unix()
	tags, _ := json.Marshal(t.Tags)
	_, err := s.store().DB.Exec(
		`UPDATE todos SET title=?,list=?,due_at=?,reminder_at=?,repeat=?,done=?,important=?,tags=?,notes=?,parent_id=?,updated_at=? WHERE id=?`,
		t.Title, t.List, nullableI64(t.DueAt), nullableI64(t.ReminderAt), nullableStr(t.Repeat),
		boolToInt(t.Done), boolToInt(t.Important), string(tags), t.Notes, nullableStr(t.ParentID),
		t.UpdatedAt, t.ID,
	)
	if err == nil {
		core.GlobalBus.Publish("todo.updated", map[string]interface{}{"id": t.ID})
	}
	return err
}

func (s *TodoService) Toggle(id string) error {
	_, err := s.store().DB.Exec(
		`UPDATE todos SET done = 1 - done, updated_at=? WHERE id=?`,
		time.Now().Unix(), id)
	if err == nil {
		core.GlobalBus.Publish("todo.toggled", map[string]interface{}{"id": id})
	}
	return err
}

func (s *TodoService) Delete(id string) error {
	_, err := s.store().DB.Exec(`DELETE FROM todos WHERE id=?`, id)
	if err == nil {
		core.GlobalBus.Publish("todo.deleted", map[string]interface{}{"id": id})
	}
	return err
}

// List returns todos for a list; "today" assembles items due today, "important"
// pulls flagged items, "all" returns everything. Custom lists match exactly.
func (s *TodoService) List(name string) ([]Todo, error) {
	var (
		rows *sql.Rows
		err  error
		base = `SELECT id,title,list,COALESCE(due_at,0),COALESCE(reminder_at,0),COALESCE(repeat,''),
				done,important,tags,notes,COALESCE(parent_id,''),created_at,updated_at FROM todos`
	)
	switch strings.ToLower(name) {
	case "today":
		dayStart := time.Now().Truncate(24 * time.Hour).Unix()
		dayEnd := dayStart + 86400
		rows, err = s.store().DB.Query(base+` WHERE due_at BETWEEN ? AND ? ORDER BY due_at`, dayStart, dayEnd)
	case "important":
		rows, err = s.store().DB.Query(base+` WHERE important=1 ORDER BY due_at ASC, created_at DESC`)
	case "planned":
		rows, err = s.store().DB.Query(base+` WHERE due_at IS NOT NULL ORDER BY due_at`)
	case "all", "":
		rows, err = s.store().DB.Query(base + ` ORDER BY updated_at DESC LIMIT 500`)
	default:
		rows, err = s.store().DB.Query(base+` WHERE list=? ORDER BY done ASC, created_at DESC`, name)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Todo{}
	for rows.Next() {
		var t Todo
		var tagsRaw string
		var done, important int
		if err := rows.Scan(&t.ID, &t.Title, &t.List, &t.DueAt, &t.ReminderAt, &t.Repeat,
			&done, &important, &tagsRaw, &t.Notes, &t.ParentID, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		t.Done = done == 1
		t.Important = important == 1
		_ = json.Unmarshal([]byte(tagsRaw), &t.Tags)
		if t.Tags == nil {
			t.Tags = []string{}
		}
		out = append(out, t)
	}
	return out, nil
}

// DueSoon returns items whose reminder_at falls within the next N minutes.
// The frontend polls this on a 60s tick and dispatches Windows toasts.
func (s *TodoService) DueSoon(minutes int) ([]Todo, error) {
	if minutes <= 0 {
		minutes = 15
	}
	now := time.Now().Unix()
	end := now + int64(minutes*60)
	rows, err := s.store().DB.Query(
		`SELECT id,title,list,COALESCE(due_at,0),COALESCE(reminder_at,0),COALESCE(repeat,''),
		done,important,tags,notes,COALESCE(parent_id,''),created_at,updated_at
		FROM todos WHERE reminder_at BETWEEN ? AND ? AND done=0`, now, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Todo{}
	for rows.Next() {
		var t Todo
		var tagsRaw string
		var done, important int
		if err := rows.Scan(&t.ID, &t.Title, &t.List, &t.DueAt, &t.ReminderAt, &t.Repeat,
			&done, &important, &tagsRaw, &t.Notes, &t.ParentID, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		t.Done = done == 1
		t.Important = important == 1
		_ = json.Unmarshal([]byte(tagsRaw), &t.Tags)
		if t.Tags == nil {
			t.Tags = []string{}
		}
		out = append(out, t)
	}
	return out, nil
}

// Lists returns all unique list names plus their counts.
func (s *TodoService) Lists() ([]map[string]interface{}, error) {
	rows, err := s.store().DB.Query(
		`SELECT list, COUNT(*) FROM todos WHERE done=0 GROUP BY list ORDER BY list`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]interface{}{}
	for rows.Next() {
		var name string
		var count int
		if err := rows.Scan(&name, &count); err != nil {
			return nil, err
		}
		out = append(out, map[string]interface{}{"name": name, "count": count})
	}
	return out, nil
}

func nullableI64(v int64) interface{} {
	if v == 0 {
		return nil
	}
	return v
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

var _ = errors.New
