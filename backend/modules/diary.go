// Package modules — diary: one line a day plus auto-summaries that
// aggregate activity from the other modules.
package modules

import (
	"time"

	"personal-terminal/backend/core"
	"personal-terminal/backend/db"
)

type DiaryEntry struct {
	ID        string `json:"id"`
	Day       string `json:"day"` // YYYY-MM-DD
	Line      string `json:"line"`
	Mood      int    `json:"mood"`
	Extra     string `json:"extra"`
	CreatedAt int64  `json:"created_at"`
}

type DiaryService struct{}

func NewDiaryService() *DiaryService { return &DiaryService{} }
func (s *DiaryService) store() *db.Store { return core.GlobalStore.(*db.Store) }

func dayStr(ts int64) string { return time.Unix(ts, 0).Format("2006-01-02") }

// Save upserts today's (or the given day's) one-liner.
func (s *DiaryService) Save(e DiaryEntry) (*DiaryEntry, error) {
	if e.Line == "" {
		return nil, errRequired("line")
	}
	if e.Day == "" {
		e.Day = dayStr(time.Now().Unix())
	}
	if e.Mood == 0 {
		e.Mood = 3
	}
	var id string
	err := s.store().DB.QueryRow(`SELECT id FROM diary_entries WHERE day=?`, e.Day).Scan(&id)
	if err == nil {
		_, err = s.store().DB.Exec(`UPDATE diary_entries SET line=?,mood=?,extra=? WHERE id=?`, e.Line, e.Mood, e.Extra, id)
		e.ID = id
	} else {
		e.ID = newID("dy_")
		e.CreatedAt = time.Now().Unix()
		_, err = s.store().DB.Exec(
			`INSERT INTO diary_entries(id,day,line,mood,extra,created_at) VALUES(?,?,?,?,?,?)`,
			e.ID, e.Day, e.Line, e.Mood, e.Extra, e.CreatedAt)
	}
	if err != nil {
		return nil, err
	}
	awardXP(5, "diary:"+e.Day, "mind")
	core.GlobalBus.Publish("diary.saved", map[string]interface{}{"day": e.Day})
	return &e, nil
}

func (s *DiaryService) Delete(id string) error {
	_, err := s.store().DB.Exec(`DELETE FROM diary_entries WHERE id=?`, id)
	return err
}

// List returns entries in a range (days back from today, default 60).
func (s *DiaryService) List(daysBack int) ([]DiaryEntry, error) {
	if daysBack <= 0 {
		daysBack = 60
	}
	since := time.Now().AddDate(0, 0, -daysBack).Unix()
	rows, err := s.store().DB.Query(
		`SELECT id,day,line,mood,extra,created_at FROM diary_entries WHERE created_at>=? OR day>=? ORDER BY day DESC`,
		since, dayStr(since))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []DiaryEntry{}
	for rows.Next() {
		var e DiaryEntry
		if err := rows.Scan(&e.ID, &e.Day, &e.Line, &e.Mood, &e.Extra, &e.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, nil
}

// OnThisDay returns entries from the same month-day in previous years.
func (s *DiaryService) OnThisDay() ([]DiaryEntry, error) {
	md := time.Now().Format("01-02")
	rows, err := s.store().DB.Query(
		`SELECT id,day,line,mood,extra,created_at FROM diary_entries WHERE substr(day,6)<? ORDER BY day DESC`, md)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []DiaryEntry{}
	for rows.Next() {
		var e DiaryEntry
		if err := rows.Scan(&e.ID, &e.Day, &e.Line, &e.Mood, &e.Extra, &e.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, nil
}

// Summary aggregates module activity for a period: "week" | "month" | "year".
func (s *DiaryService) Summary(period string) (map[string]interface{}, error) {
	var since time.Time
	switch period {
	case "week":
		since = time.Now().AddDate(0, 0, -7)
	case "year":
		since = time.Now().AddDate(-1, 0, 0)
	default:
		since = time.Now().AddDate(0, -1, 0)
	}
	unix := since.Unix()

	count := func(table, where string, args ...interface{}) int {
		var n int
		q := `SELECT COUNT(*) FROM ` + table + ` WHERE ` + where
		args2 := append([]interface{}{}, args...)
		_ = s.store().DB.QueryRow(q, args2...).Scan(&n)
		return n
	}

	diaryDays := count("diary_entries", "created_at>=?", unix)
	noteCount := count("notes", "created_at>=?", unix)
	fleetingCount := count("fleeting", "created_at>=?", unix)
	todosDone := count("todos", "done=1 AND updated_at>=?", unix)
	pomodoros := count("pomodoros", "kind='focus' AND started_at>=?", unix)
	xpEarned := 0
	_ = s.store().DB.QueryRow(`SELECT COALESCE(SUM(amount),0) FROM xp_log WHERE earned_at>=?`, unix).Scan(&xpEarned)

	avgMood := 0.0
	_ = s.store().DB.QueryRow(`SELECT COALESCE(AVG(mood),0) FROM diary_entries WHERE created_at>=?`, unix).Scan(&avgMood)

	return map[string]interface{}{
		"period": period, "since": unix,
		"diary_days": diaryDays, "notes": noteCount, "fleeting": fleetingCount,
		"todos_done": todosDone, "pomodoros": pomodoros, "xp": xpEarned,
		"avg_mood": avgMood,
	}, nil
}
