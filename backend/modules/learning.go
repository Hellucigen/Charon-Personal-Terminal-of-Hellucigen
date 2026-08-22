// Package modules — learning: SRS flashcards with a simplified SM-2
// scheduler, JSON/CSV import, and a quick-quiz generator.
package modules

import (
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"personal-terminal/backend/core"
	"personal-terminal/backend/db"
)

type Deck struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CreatedAt int64  `json:"created_at"`
}

type Card struct {
	ID        string  `json:"id"`
	DeckID    string  `json:"deck_id"`
	Front     string  `json:"front"`
	Back      string  `json:"back"`
	Ease      float64 `json:"ease"`
	IntervalD int     `json:"interval_d"`
	Reps      int     `json:"reps"`
	Lapses    int     `json:"lapses"`
	DueAt     int64   `json:"due_at"`
	CreatedAt int64   `json:"created_at"`
}

type LearningService struct{}

func NewLearningService() *LearningService { return &LearningService{} }
func (s *LearningService) store() *db.Store { return core.GlobalStore.(*db.Store) }

func (s *LearningService) SaveDeck(name string) (*Deck, error) {
	if name == "" {
		return nil, errRequired("name")
	}
	d := &Deck{ID: newID("dk_"), Name: name, CreatedAt: time.Now().Unix()}
	_, err := s.store().DB.Exec(`INSERT INTO learn_decks(id,name,created_at) VALUES(?,?,?)`, d.ID, d.Name, d.CreatedAt)
	if err != nil {
		return nil, err
	}
	return d, nil
}

func (s *LearningService) DeleteDeck(id string) error {
	if _, err := s.store().DB.Exec(`DELETE FROM learn_cards WHERE deck_id=?`, id); err != nil {
		return err
	}
	_, err := s.store().DB.Exec(`DELETE FROM learn_decks WHERE id=?`, id)
	return err
}

func (s *LearningService) Decks() ([]map[string]interface{}, error) {
	rows, err := s.store().DB.Query(`
		SELECT d.id, d.name, d.created_at,
			(SELECT COUNT(*) FROM learn_cards c WHERE c.deck_id=d.id) AS total,
			(SELECT COUNT(*) FROM learn_cards c WHERE c.deck_id=d.id AND c.due_at<=?) AS due
		FROM learn_decks d ORDER BY d.created_at DESC`, time.Now().Unix())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]interface{}{}
	for rows.Next() {
		var id, name string
		var created int64
		var total, due int
		if err := rows.Scan(&id, &name, &created, &total, &due); err != nil {
			return nil, err
		}
		out = append(out, map[string]interface{}{"id": id, "name": name, "created_at": created, "total": total, "due": due})
	}
	return out, nil
}

func (s *LearningService) SaveCard(c Card) (*Card, error) {
	if c.Front == "" || c.Back == "" {
		return nil, errRequired("front/back")
	}
	if c.Ease == 0 {
		c.Ease = 2.5
	}
	now := time.Now().Unix()
	if c.ID == "" {
		c.ID = newID("cd_")
		c.CreatedAt = now
		c.DueAt = now
		_, err := s.store().DB.Exec(
			`INSERT INTO learn_cards(id,deck_id,front,back,ease,interval_d,reps,lapses,due_at,created_at)
			 VALUES(?,?,?,?,?,?,?,?,?,?)`,
			c.ID, c.DeckID, c.Front, c.Back, c.Ease, c.IntervalD, c.Reps, c.Lapses, c.DueAt, c.CreatedAt)
		if err != nil {
			return nil, err
		}
	} else {
		_, err := s.store().DB.Exec(
			`UPDATE learn_cards SET front=?,back=? WHERE id=?`, c.Front, c.Back, c.ID)
		if err != nil {
			return nil, err
		}
	}
	return &c, nil
}

func (s *LearningService) DeleteCard(id string) error {
	_, err := s.store().DB.Exec(`DELETE FROM learn_cards WHERE id=?`, id)
	return err
}

// Cards lists a deck's cards; dueOnly filters to what is reviewable now.
func (s *LearningService) Cards(deckID string, dueOnly bool) ([]Card, error) {
	q := `SELECT id,deck_id,front,back,ease,interval_d,reps,lapses,due_at,created_at FROM learn_cards WHERE deck_id=?`
	if dueOnly {
		rows, err := s.store().DB.Query(q+` AND due_at<=? ORDER BY due_at`, deckID, time.Now().Unix())
		return s.scanCards(rows, err)
	}
	rows, err := s.store().DB.Query(q+` ORDER BY due_at`, deckID)
	return s.scanCards(rows, err)
}

func (s *LearningService) scanCards(rows *sql.Rows, err error) ([]Card, error) {
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Card{}
	for rows.Next() {
		var c Card
		if err := rows.Scan(&c.ID, &c.DeckID, &c.Front, &c.Back, &c.Ease, &c.IntervalD, &c.Reps, &c.Lapses, &c.DueAt, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, nil
}

// Review grades a card (0 again, 1 hard, 2 good, 3 easy) with a simplified
// SM-2 update and returns the next due timestamp.
func (s *LearningService) Review(cardID string, grade int) (map[string]interface{}, error) {
	var c Card
	err := s.store().DB.QueryRow(
		`SELECT id,deck_id,front,back,ease,interval_d,reps,lapses,due_at,created_at FROM learn_cards WHERE id=?`, cardID,
	).Scan(&c.ID, &c.DeckID, &c.Front, &c.Back, &c.Ease, &c.IntervalD, &c.Reps, &c.Lapses, &c.DueAt, &c.CreatedAt)
	if err != nil {
		return nil, err
	}

	switch {
	case grade <= 0: // again
		c.Lapses++
		c.IntervalD = 0
		c.Ease = max64(c.Ease-0.2, 1.3)
	case grade == 1: // hard
		c.Ease = max64(c.Ease-0.15, 1.3)
		c.IntervalD = maxi(c.IntervalD, 1)
	case grade == 2: // good
		if c.IntervalD == 0 {
			c.IntervalD = 1
		} else if c.IntervalD == 1 {
			c.IntervalD = 3
		} else {
			c.IntervalD = int(float64(c.IntervalD)*c.Ease + 0.5)
		}
	case grade >= 3: // easy
		c.Ease += 0.15
		if c.IntervalD == 0 {
			c.IntervalD = 3
		} else {
			c.IntervalD = int(float64(c.IntervalD)*c.Ease*1.3 + 0.5)
		}
	}
	c.Reps++
	var next int64
	if c.IntervalD == 0 {
		next = time.Now().Add(10 * time.Minute).Unix() // relearn in 10 min
	} else {
		next = time.Now().Add(time.Duration(c.IntervalD) * 24 * time.Hour).Unix()
	}
	if _, err := s.store().DB.Exec(
		`UPDATE learn_cards SET ease=?,interval_d=?,reps=?,lapses=?,due_at=? WHERE id=?`,
		c.Ease, c.IntervalD, c.Reps, c.Lapses, next, c.ID); err != nil {
		return nil, err
	}
	awardXP(2, "learning.review:"+c.ID, "mind")
	return map[string]interface{}{
		"card_id": c.ID, "interval_d": c.IntervalD, "ease": c.Ease, "due_at": next,
	}, nil
}

// Import loads cards from a JSON array [{front,back}, ...] or a CSV with a
// front,back header into the given deck. Returns the number added.
func (s *LearningService) Import(deckID, path string) (int, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return 0, err
	}
	type fb struct{ Front, Back string }
	cards := []fb{}
	if strings.HasSuffix(strings.ToLower(path), ".json") {
		if err := json.Unmarshal(data, &cards); err != nil {
			return 0, fmt.Errorf("bad JSON (want [{front,back}]): %w", err)
		}
	} else {
		r := csv.NewReader(strings.NewReader(string(data)))
		r.FieldsPerRecord = -1
		rows, err := r.ReadAll()
		if err != nil {
			return 0, err
		}
		for i, row := range rows {
			if i == 0 && strings.Contains(strings.ToLower(row[0]), "front") {
				continue
			}
			if len(row) >= 2 {
				cards = append(cards, fb{Front: row[0], Back: row[1]})
			}
		}
	}
	n := 0
	now := time.Now().Unix()
	for _, c := range cards {
		if c.Front == "" || c.Back == "" {
			continue
		}
		_, err := s.store().DB.Exec(
			`INSERT INTO learn_cards(id,deck_id,front,back,ease,interval_d,reps,lapses,due_at,created_at)
			 VALUES(?,?,?,?,2.5,0,0,0,?,?)`,
			newID("cd_"), deckID, c.Front, c.Back, now, now)
		if err != nil {
			return n, err
		}
		n++
	}
	core.GlobalBus.Publish("learning.imported", map[string]interface{}{"deck": deckID, "count": n})
	return n, nil
}

// Quiz returns up to n random cards from a deck regardless of due state —
// for the idle popup quiz.
func (s *LearningService) Quiz(deckID string, n int) ([]Card, error) {
	if n <= 0 {
		n = 10
	}
	rows, err := s.store().DB.Query(
		`SELECT id,deck_id,front,back,ease,interval_d,reps,lapses,due_at,created_at
		 FROM learn_cards WHERE deck_id=? ORDER BY RANDOM() LIMIT ?`, deckID, n)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Card{}
	for rows.Next() {
		var c Card
		if err := rows.Scan(&c.ID, &c.DeckID, &c.Front, &c.Back, &c.Ease, &c.IntervalD, &c.Reps, &c.Lapses, &c.DueAt, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, nil
}

func max64(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

func maxi(a, b int) int {
	if a > b {
		return a
	}
	return b
}
