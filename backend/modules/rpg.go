// Package modules — RPG: XP with six life stats, levels, achievements.
// Other services call awardXP() when something notable happens.
package modules

import (
	"time"

	"personal-terminal/backend/core"
	"personal-terminal/backend/db"
)

var statNames = []string{"body", "mind", "create", "social", "wealth", "will"}
var statLabels = map[string]string{
	"body": "体力", "mind": "智力", "create": "创造", "social": "社交", "wealth": "财力", "will": "意志",
}

type Achievement struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Unlocked    bool   `json:"unlocked"`
	UnlockedAt  int64  `json:"unlocked_at,omitempty"`
}

type RPGService struct{}

func NewRPGService() *RPGService { return &RPGService{} }
func (s *RPGService) store() *db.Store { return core.GlobalStore.(*db.Store) }

// awardXP is the shared hook used by other modules; amount<=0 is ignored.
func awardXP(amount int, source, stat string) {
	if amount <= 0 {
		return
	}
	valid := statLabels[stat] != ""
	if !valid {
		stat = "will"
	}
	st := core.GlobalStore
	if st == nil {
		return
	}
	store := st.(*db.Store)
	_, err := store.DB.Exec(
		`INSERT INTO xp_log(id,amount,source,stat,earned_at) VALUES(?,?,?,?,?)`,
		newID("xp_"), amount, source, stat, time.Now().Unix())
	if err == nil && core.GlobalBus != nil {
		core.GlobalBus.Publish("rpg.xp", map[string]interface{}{"amount": amount, "source": source, "stat": stat})
	}
}

// Award lets the frontend grant XP for ad-hoc actions.
func (s *RPGService) Award(amount int, source, stat string) error {
	awardXP(amount, source, stat)
	return nil
}

// level curve: level N requires 100·N² total XP — level 1 at 100, 2 at 400,
// 3 at 900... deliberately quadratic so early wins feel fast.
func levelFor(xp int) int {
	lvl := 0
	for 100*(lvl+1)*(lvl+1) <= xp {
		lvl++
	}
	return lvl + 1
}

// Profile returns XP totals, level, per-stat breakdown and titles.
func (s *RPGService) Profile() (map[string]interface{}, error) {
	var total int
	_ = s.store().DB.QueryRow(`SELECT COALESCE(SUM(amount),0) FROM xp_log`).Scan(&total)

	stats := map[string]int{}
	for _, name := range statNames {
		var v int
		_ = s.store().DB.QueryRow(`SELECT COALESCE(SUM(amount),0) FROM xp_log WHERE stat=?`, name).Scan(&v)
		stats[name] = v
	}

	recent := []map[string]interface{}{}
	rows, err := s.store().DB.Query(`SELECT amount,source,stat,earned_at FROM xp_log ORDER BY earned_at DESC LIMIT 15`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var amount int
		var source, stat string
		var at int64
		_ = rows.Scan(&amount, &source, &stat, &at)
		recent = append(recent, map[string]interface{}{"amount": amount, "source": source, "stat": stat, "earned_at": at})
	}
	rows.Close()

	lvl := levelFor(total)
	nextAt := 100 * lvl * lvl
	titles := []string{"旁观者", "见习生", "操作员", "架构师", "指挥官", "造物主"}
	title := titles[len(titles)-1]
	if lvl-1 < len(titles) {
		title = titles[lvl-1]
	}

	return map[string]interface{}{
		"xp": total, "level": lvl, "next_level_xp": nextAt, "title": title,
		"stats": stats, "stat_labels": statLabels, "recent": recent,
	}, nil
}

// ── achievements ───────────────────────────────────────────────────────

func (s *RPGService) SaveAchievement(a Achievement) (*Achievement, error) {
	if a.Title == "" {
		return nil, errRequired("title")
	}
	done := 0
	if a.Unlocked {
		done = 1
	}
	if a.ID == "" {
		a.ID = newID("ac_")
		var unlocked int64
		if a.Unlocked {
			unlocked = time.Now().Unix()
		}
		_, err := s.store().DB.Exec(
			`INSERT INTO achievements(id,title,description,unlocked,unlocked_at) VALUES(?,?,?,?,?)`,
			a.ID, a.Title, a.Description, done, nullableI64(unlocked))
		if err != nil {
			return nil, err
		}
	} else {
		_, err := s.store().DB.Exec(
			`UPDATE achievements SET title=?,description=?,unlocked=? WHERE id=?`,
			a.Title, a.Description, done, a.ID)
		if err != nil {
			return nil, err
		}
	}
	core.GlobalBus.Publish("rpg.achievement", map[string]interface{}{"id": a.ID})
	return &a, nil
}

func (s *RPGService) UnlockAchievement(id string) error {
	_, err := s.store().DB.Exec(
		`UPDATE achievements SET unlocked=1, unlocked_at=? WHERE id=?`, time.Now().Unix(), id)
	if err == nil {
		core.GlobalBus.Publish("rpg.achievement.unlocked", map[string]interface{}{"id": id})
	}
	return err
}

func (s *RPGService) DeleteAchievement(id string) error {
	_, err := s.store().DB.Exec(`DELETE FROM achievements WHERE id=?`, id)
	return err
}

func (s *RPGService) Achievements() ([]Achievement, error) {
	rows, err := s.store().DB.Query(`SELECT id,title,COALESCE(description,''),unlocked,COALESCE(unlocked_at,0) FROM achievements ORDER BY unlocked, created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Achievement{}
	for rows.Next() {
		var a Achievement
		var done int
		if err := rows.Scan(&a.ID, &a.Title, &a.Description, &done, &a.UnlockedAt); err != nil {
			return nil, err
		}
		a.Unlocked = done == 1
		out = append(out, a)
	}
	return out, nil
}

// CheckAchievements evaluates simple rule-based achievements from live data.
func (s *RPGService) CheckAchievements() ([]string, error) {
	unlocked := []string{}
	count := func(q string, args ...interface{}) int {
		var n int
		_ = s.store().DB.QueryRow(q, args...).Scan(&n)
		return n
	}
	check := func(key, title, desc string, n int) {
		if n <= 0 {
			return
		}
		var id string
		if err := s.store().DB.QueryRow(`SELECT id FROM achievements WHERE title=?`, title).Scan(&id); err != nil {
			a, err := s.SaveAchievement(Achievement{Title: title, Description: desc, Unlocked: true})
			if err == nil {
				unlocked = append(unlocked, title)
				_ = a
			}
		}
	}
	check("diary7", "连续记梦 7 天", "连续 7 天写了日记", count(`SELECT COUNT(*) FROM diary_entries`))
	check("notes10", "藏书家", "累计 10 篇笔记", count(`SELECT COUNT(*) FROM notes`))
	check("fleeting20", "碎片收藏家", "累计 20 条碎片", count(`SELECT COUNT(*) FROM fleeting`))
	check("todo50", "执行者", "完成 50 个待办", count(`SELECT COUNT(*) FROM todos WHERE done=1`))
	check("pomodoro10", "专注者", "累计 10 个番茄钟", count(`SELECT COUNT(*) FROM pomodoros WHERE kind='focus'`))
	check("cards50", "记忆大师", "复习 50 次卡片", count(`SELECT COALESCE(SUM(reps),0) FROM learn_cards`))
	return unlocked, nil
}
