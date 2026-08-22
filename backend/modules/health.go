// Package modules — health: lightweight metric logging on top of the
// habit_logs table (weight / sleep / water / custom habits), with series,
// latest values and streaks.
package modules

import (
	"time"

	"personal-terminal/backend/core"
	"personal-terminal/backend/db"
)

type HabitLog struct {
	ID       string  `json:"id"`
	Habit    string  `json:"habit"`
	Value    float64 `json:"value"`
	Unit     string  `json:"unit,omitempty"`
	LoggedAt int64   `json:"logged_at"`
	Note     string  `json:"note"`
}

type HealthService struct{}

func NewHealthService() *HealthService { return &HealthService{} }
func (s *HealthService) store() *db.Store { return core.GlobalStore.(*db.Store) }

// Log records one measurement ("weight", 72.5, "kg") or habit tick.
func (s *HealthService) Log(habit string, value float64, unit, note string) (*HabitLog, error) {
	if habit == "" {
		return nil, errRequired("habit")
	}
	l := &HabitLog{ID: newID("hl_"), Habit: habit, Value: value, Unit: unit, LoggedAt: time.Now().Unix(), Note: note}
	_, err := s.store().DB.Exec(
		`INSERT INTO habit_logs(id,habit,value,unit,logged_at,note) VALUES(?,?,?,?,?,?)`,
		l.ID, l.Habit, l.Value, nullableStr(l.Unit), l.LoggedAt, l.Note)
	if err != nil {
		return nil, err
	}
	core.GlobalBus.Publish("health.logged", map[string]interface{}{"habit": habit, "value": value})
	return l, nil
}

func (s *HealthService) Delete(id string) error {
	_, err := s.store().DB.Exec(`DELETE FROM habit_logs WHERE id=?`, id)
	return err
}

// Series returns the last N logs of one habit, oldest first.
func (s *HealthService) Series(habit string, limit int) ([]HabitLog, error) {
	if limit <= 0 {
		limit = 30
	}
	rows, err := s.store().DB.Query(
		`SELECT id,habit,value,COALESCE(unit,''),logged_at,note FROM habit_logs
		 WHERE habit=? ORDER BY logged_at DESC LIMIT ?`, habit, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []HabitLog{}
	for rows.Next() {
		var l HabitLog
		if err := rows.Scan(&l.ID, &l.Habit, &l.Value, &l.Unit, &l.LoggedAt, &l.Note); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, nil
}

// Overview lists every habit with its latest value, today's count and the
// current daily streak — one call to render the whole module.
func (s *HealthService) Overview() ([]map[string]interface{}, error) {
	rows, err := s.store().DB.Query(`SELECT DISTINCT habit FROM habit_logs`)
	if err != nil {
		return nil, err
	}
	habits := []string{}
	for rows.Next() {
		var h string
		_ = rows.Scan(&h)
		habits = append(habits, h)
	}
	rows.Close()

	out := []map[string]interface{}{}
	for _, h := range habits {
		var latest HabitLog
		has := true
		err := s.store().DB.QueryRow(
			`SELECT id,habit,value,COALESCE(unit,''),logged_at,note FROM habit_logs WHERE habit=? ORDER BY logged_at DESC LIMIT 1`, h,
		).Scan(&latest.ID, &latest.Habit, &latest.Value, &latest.Unit, &latest.LoggedAt, &latest.Note)
		if err != nil {
			has = false
		}

		var today int
		dayStart := time.Now().Truncate(24 * time.Hour).Unix()
		_ = s.store().DB.QueryRow(
			`SELECT COUNT(*) FROM habit_logs WHERE habit=? AND logged_at>=?`, h, dayStart).Scan(&today)

		streak := 0
		for d := 0; d < 365; d++ {
			start := dayStart - int64(d)*86400
			var n int
			_ = s.store().DB.QueryRow(
				`SELECT COUNT(*) FROM habit_logs WHERE habit=? AND logged_at>=? AND logged_at<?`, h, start, start+86400).Scan(&n)
			if n > 0 {
				streak++
			} else if d == 0 {
				continue // today may not be logged yet — don't break the streak
			} else {
				break
			}
		}

		entry := map[string]interface{}{"habit": h, "today": today, "streak": streak, "logs": 0}
		if has {
			entry["latest"] = latest
		}
		var total int
		_ = s.store().DB.QueryRow(`SELECT COUNT(*) FROM habit_logs WHERE habit=?`, h).Scan(&total)
		entry["logs"] = total
		out = append(out, entry)
	}
	return out, nil
}
