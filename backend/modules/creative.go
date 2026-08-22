// Package modules — creative: moodboards (colors / text / image refs) and
// writing sessions with a daily word goal.
package modules

import (
	"encoding/json"
	"time"

	"personal-terminal/backend/core"
	"personal-terminal/backend/db"
)

type Board struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Kind      string          `json:"kind"` // moodboard|story
	Items     []BoardItem     `json:"items"`
	UpdatedAt int64           `json:"updated_at"`
}

type BoardItem struct {
	Type  string `json:"type"` // color|text|image
	Value string `json:"value"`
	Label string `json:"label,omitempty"`
}

type WritingSession struct {
	ID        string `json:"id"`
	Day       string `json:"day"`
	Words     int    `json:"words"`
	Note      string `json:"note"`
	CreatedAt int64  `json:"created_at"`
}

type CreativeService struct{}

func NewCreativeService() *CreativeService { return &CreativeService{} }
func (s *CreativeService) store() *db.Store { return core.GlobalStore.(*db.Store) }

func (s *CreativeService) SaveBoard(b Board) (*Board, error) {
	if b.Name == "" {
		return nil, errRequired("name")
	}
	if b.Items == nil {
		b.Items = []BoardItem{}
	}
	items, _ := json.Marshal(b.Items)
	b.UpdatedAt = time.Now().Unix()
	if b.ID == "" {
		b.ID = newID("cb_")
		_, err := s.store().DB.Exec(
			`INSERT INTO creative_boards(id,name,kind,items,updated_at) VALUES(?,?,?,?,?)`,
			b.ID, b.Name, b.Kind, string(items), b.UpdatedAt)
		if err != nil {
			return nil, err
		}
	} else {
		_, err := s.store().DB.Exec(
			`UPDATE creative_boards SET name=?,kind=?,items=?,updated_at=? WHERE id=?`,
			b.Name, b.Kind, string(items), b.UpdatedAt, b.ID)
		if err != nil {
			return nil, err
		}
	}
	return &b, nil
}

func (s *CreativeService) DeleteBoard(id string) error {
	_, err := s.store().DB.Exec(`DELETE FROM creative_boards WHERE id=?`, id)
	return err
}

func (s *CreativeService) Boards(kind string) ([]Board, error) {
	q := `SELECT id,name,kind,items,updated_at FROM creative_boards`
	if kind != "" {
		q += ` WHERE kind=? ORDER BY updated_at DESC`
		rows, err := s.store().DB.Query(q, kind)
		return s.scanBoards(rows, err)
	}
	rows, err := s.store().DB.Query(q + ` ORDER BY updated_at DESC`)
	return s.scanBoards(rows, err)
}

func (s *CreativeService) scanBoards(rows interface {
	Next() bool
	Scan(dest ...interface{}) error
	Close() error
}, err error) ([]Board, error) {
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Board{}
	for rows.Next() {
		var b Board
		var itemsRaw string
		if err := rows.Scan(&b.ID, &b.Name, &b.Kind, &itemsRaw, &b.UpdatedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal([]byte(itemsRaw), &b.Items)
		if b.Items == nil {
			b.Items = []BoardItem{}
		}
		out = append(out, b)
	}
	return out, nil
}

// ── writing sessions ───────────────────────────────────────────────────

func (s *CreativeService) LogWriting(words int, note string) (*WritingSession, error) {
	if words <= 0 {
		return nil, errRequired("words")
	}
	w := &WritingSession{ID: newID("ws_"), Day: time.Now().Format("2006-01-02"), Words: words, Note: note, CreatedAt: time.Now().Unix()}
	_, err := s.store().DB.Exec(
		`INSERT INTO writing_sessions(id,day,words,note,created_at) VALUES(?,?,?,?,?)`,
		w.ID, w.Day, w.Words, w.Note, w.CreatedAt)
	if err != nil {
		return nil, err
	}
	awardXP(words/100, "creative.writing", "create")
	core.GlobalBus.Publish("creative.writing", map[string]interface{}{"words": words})
	return w, nil
}

// WritingStats returns today's words, the daily goal and the last 30 days.
func (s *CreativeService) WritingStats(goal int) (map[string]interface{}, error) {
	if goal <= 0 {
		goal = 500
	}
	today := time.Now().Format("2006-01-02")
	var todayWords int
	_ = s.store().DB.QueryRow(`SELECT COALESCE(SUM(words),0) FROM writing_sessions WHERE day=?`, today).Scan(&todayWords)

	rows, err := s.store().DB.Query(
		`SELECT day, COALESCE(SUM(words),0) FROM writing_sessions WHERE day>=? GROUP BY day ORDER BY day`,
		time.Now().AddDate(0, 0, -30).Format("2006-01-02"))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	days := []map[string]interface{}{}
	for rows.Next() {
		var d string
		var w int
		_ = rows.Scan(&d, &w)
		days = append(days, map[string]interface{}{"day": d, "words": w})
	}
	return map[string]interface{}{"today": todayWords, "goal": goal, "days": days}, nil
}
