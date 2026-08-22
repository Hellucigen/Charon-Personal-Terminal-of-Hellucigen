// Package modules — data center: cross-module overview, GitHub-style
// activity heatmap, year-in-review and full JSON export.
package modules

import (
	"encoding/json"
	"fmt"
	"time"

	"personal-terminal/backend/core"
	"personal-terminal/backend/db"
)

type DataService struct{}

func NewDataService() *DataService { return &DataService{} }
func (s *DataService) store() *db.Store { return core.GlobalStore.(*db.Store) }

func (s *DataService) count(where string, args ...interface{}) int {
	var n int
	_ = s.store().DB.QueryRow(`SELECT COUNT(*) FROM `+where, args...).Scan(&n)
	return n
}

// Overview returns today / week / month / year activity across modules.
func (s *DataService) Overview() (map[string]interface{}, error) {
	now := time.Now()
	buckets := map[string]int64{
		"today": now.Truncate(24 * time.Hour).Unix(),
		"week":  now.AddDate(0, 0, -7).Unix(),
		"month": now.AddDate(0, -1, 0).Unix(),
		"year":  now.AddDate(-1, 0, 0).Unix(),
	}
	out := map[string]interface{}{}
	for name, since := range buckets {
		out[name] = map[string]interface{}{
			"notes":      s.count(`notes WHERE created_at>=?`, since),
			"fleeting":   s.count(`fleeting WHERE created_at>=?`, since),
			"todos_done": s.count(`todos WHERE done=1 AND updated_at>=?`, since),
			"pomodoros":  s.count(`pomodoros WHERE kind='focus' AND started_at>=?`, since),
			"diary":      s.count(`diary_entries WHERE created_at>=?`, since),
			"reviews":    s.count(`learn_cards WHERE reps>0 AND due_at>0`),
			"xp":         s.sumXP(since),
		}
	}
	return out, nil
}

func (s *DataService) sumXP(since int64) int {
	var v int
	_ = s.store().DB.QueryRow(`SELECT COALESCE(SUM(amount),0) FROM xp_log WHERE earned_at>=?`, since).Scan(&v)
	return v
}

// Heatmap returns per-day activity scores for the last N days (default 182).
// Score = notes*3 + fleeting*1 + todos_done*2 + pomodoros*2 + diary*2.
func (s *DataService) Heatmap(days int) ([]map[string]interface{}, error) {
	if days <= 0 {
		days = 182
	}
	since := time.Now().AddDate(0, 0, -days).Format("2006-01-02")
	q := `
		SELECT day, score FROM (
			SELECT date(created_at,'unixepoch') AS day, COUNT(*)*3 AS score FROM notes WHERE created_at>=strftime('%s',?) GROUP BY day
			UNION ALL SELECT date(created_at,'unixepoch'), COUNT(*) FROM fleeting WHERE created_at>=strftime('%s',?) GROUP BY day
			UNION ALL SELECT date(updated_at,'unixepoch'), COUNT(*)*2 FROM todos WHERE done=1 AND updated_at>=strftime('%s',?) GROUP BY day
			UNION ALL SELECT date(started_at,'unixepoch'), COUNT(*)*2 FROM pomodoros WHERE kind='focus' AND started_at>=strftime('%s',?) GROUP BY day
			UNION ALL SELECT day, 2 FROM diary_entries WHERE created_at>=strftime('%s',?)
		) GROUP BY day ORDER BY day`
	rows, err := s.store().DB.Query(q, since, since, since, since, since)
	if err != nil {
		return nil, err
	}
	byDay := map[string]int{}
	for rows.Next() {
		var d string
		var sc int
		_ = rows.Scan(&d, &sc)
		byDay[d] += sc
	}
	rows.Close()

	out := []map[string]interface{}{}
	for i := days; i >= 0; i-- {
		d := time.Now().AddDate(0, 0, -i).Format("2006-01-02")
		out = append(out, map[string]interface{}{"day": d, "score": byDay[d]})
	}
	return out, nil
}

// YearReview generates a plain-text year-in-review from module data.
func (s *DataService) YearReview(year int) (string, error) {
	if year == 0 {
		year = time.Now().Year()
	}
	start := time.Date(year, 1, 1, 0, 0, 0, 0, time.Local).Unix()
	end := time.Date(year+1, 1, 1, 0, 0, 0, 0, time.Local).Unix()
	in := func(col, table string) string {
		return fmt.Sprintf(`SELECT COUNT(*) FROM %s WHERE %s>=? AND %s<?`, table, col, col)
	}

	notes := s.count(in("created_at", "notes"), start, end)
	fleeting := s.count(in("created_at", "fleeting"), start, end)
	todos := s.count(in("updated_at", "todos"), start, end)
	pomos := s.count(in("started_at", "pomodoros"), start, end)
	diaryDays := s.count(in("created_at", "diary_entries"), start, end)

	var focusS int64
	_ = s.store().DB.QueryRow(
		`SELECT COALESCE(SUM(duration_s),0) FROM pomodoros WHERE kind='focus' AND started_at>=? AND started_at<?`, start, end).Scan(&focusS)

	var xp int
	_ = s.store().DB.QueryRow(
		`SELECT COALESCE(SUM(amount),0) FROM xp_log WHERE earned_at>=? AND earned_at<?`, start, end).Scan(&xp)

	var expense float64
	_ = s.store().DB.QueryRow(
		`SELECT COALESCE(SUM(-amount),0) FROM transactions WHERE amount<0 AND occurred_at>=? AND occurred_at<?`, start, end).Scan(&expense)

	var avgMood float64
	_ = s.store().DB.QueryRow(
		`SELECT COALESCE(AVG(mood),0) FROM diary_entries WHERE created_at>=? AND created_at<?`, start, end).Scan(&avgMood)

	favTemplate := ""
	_ = s.store().DB.QueryRow(
		`SELECT template, COUNT(*) c FROM notes WHERE created_at>=? AND created_at<? GROUP BY template ORDER BY c DESC LIMIT 1`, start, end).Scan(&favTemplate)

	hours := focusS / 3600
	lines := fmt.Sprintf(`═══════ %d 年度回顾 ═══════

📚 笔记 %d 篇（最常用模板：%s）
✨ 碎片想法 %d 条
✅ 完成待办 %d 个
🍅 专注番茄 %d 个，共 %d 小时
📖 写了 %d 天日记，平均心情 %.1f / 5
🎮 获得 %d XP，等级 %d
💰 总支出 ¥%.0f

—— 由 Charon 数据中心自动生成
`, year, notes, or(favTemplate, "blank"), fleeting, todos, pomos, hours, diaryDays, avgMood, xp, levelFor(xp), expense)
	return lines, nil
}

func or(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

// ExportAll dumps every table as one JSON string for backup.
func (s *DataService) ExportAll() (string, error) {
	tables := []string{
		"notes", "todos", "fleeting", "shortcuts", "bookmarks", "transactions",
		"habit_logs", "pomodoros", "app_usage", "xp_log", "achievements",
		"detective_nodes", "detective_edges", "travel_trips", "travel_entries",
		"institute_departments", "institute_actions", "institute_phases",
		"learn_decks", "learn_cards", "diary_entries", "subscriptions",
		"creative_boards", "writing_sessions", "time_blocks", "podcasts",
	}
	dump := map[string]interface{}{}
	for _, t := range tables {
		rows, err := s.store().DB.Query(`SELECT * FROM ` + t)
		if err != nil {
			continue
		}
		cols, _ := rows.Columns()
		list := []map[string]interface{}{}
		for rows.Next() {
			vals := make([]interface{}, len(cols))
			ptrs := make([]interface{}, len(cols))
			for i := range vals {
				ptrs[i] = &vals[i]
			}
			if err := rows.Scan(ptrs...); err != nil {
				continue
			}
			row := map[string]interface{}{}
			for i, c := range cols {
				b, ok := vals[i].([]byte)
				if ok {
					row[c] = string(b)
				} else {
					row[c] = vals[i]
				}
			}
			list = append(list, row)
		}
		rows.Close()
		dump[t] = list
	}
	dump["_exported_at"] = time.Now().Format(time.RFC3339)
	b, err := json.MarshalIndent(dump, "", "  ")
	return string(b), err
}
