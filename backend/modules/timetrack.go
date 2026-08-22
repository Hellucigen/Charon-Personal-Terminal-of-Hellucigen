// Package modules — time tracking: pomodoro sessions, time blocks, and
// Windows foreground-window polling for RescueTime-style app usage.
package modules

import (
	"fmt"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"

	"personal-terminal/backend/core"
	"personal-terminal/backend/db"
)

type Pomodoro struct {
	ID        string `json:"id"`
	Task      string `json:"task"`
	DurationS int    `json:"duration_s"`
	StartedAt int64  `json:"started_at"`
	EndedAt   int64  `json:"ended_at"`
	Kind      string `json:"kind"` // focus|break
}

type TimeBlock struct {
	ID    string `json:"id"`
	Day   string `json:"day"`
	Label string `json:"label"`
	Start string `json:"start"` // HH:MM
	End   string `json:"end"`
	Color string `json:"color"`
}

type TimeService struct {
	trackMu     sync.Mutex
	trackStop   chan struct{}
	trackSample map[string]int64 // "app|title" → seconds
}

func NewTimeService() *TimeService {
	return &TimeService{trackSample: map[string]int64{}}
}
func (s *TimeService) store() *db.Store { return core.GlobalStore.(*db.Store) }

// ── pomodoro ───────────────────────────────────────────────────────────

func (s *TimeService) SavePomodoro(p Pomodoro) (*Pomodoro, error) {
	if p.DurationS <= 0 {
		return nil, errRequired("duration_s")
	}
	if p.Kind == "" {
		p.Kind = "focus"
	}
	if p.EndedAt == 0 {
		p.EndedAt = time.Now().Unix()
	}
	if p.StartedAt == 0 {
		p.StartedAt = p.EndedAt - int64(p.DurationS)
	}
	p.ID = newID("pm_")
	_, err := s.store().DB.Exec(
		`INSERT INTO pomodoros(id,task,duration_s,started_at,ended_at,kind) VALUES(?,?,?,?,?,?)`,
		p.ID, p.Task, p.DurationS, p.StartedAt, p.EndedAt, p.Kind)
	if err != nil {
		return nil, err
	}
	if p.Kind == "focus" {
		awardXP(p.DurationS/300, "pomodoro:"+p.ID, "will")
	}
	return &p, nil
}

// Stats returns focus seconds grouped by day for the last N days.
func (s *TimeService) Stats(days int) ([]map[string]interface{}, error) {
	if days <= 0 {
		days = 14
	}
	since := time.Now().AddDate(0, 0, -days).Format("2006-01-02")
	rows, err := s.store().DB.Query(`
		SELECT date(started_at,'unixepoch') AS d, SUM(duration_s)
		FROM pomodoros WHERE kind='focus' AND started_at>=strftime('%s',?) GROUP BY d ORDER BY d`, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]interface{}{}
	for rows.Next() {
		var d string
		var secs int64
		_ = rows.Scan(&d, &secs)
		out = append(out, map[string]interface{}{"day": d, "focus_s": secs})
	}
	return out, nil
}

// ── time blocks ────────────────────────────────────────────────────────

func (s *TimeService) SaveBlock(b TimeBlock) (*TimeBlock, error) {
	if b.Label == "" || b.Start == "" || b.End == "" {
		return nil, errRequired("label/start/end")
	}
	if b.Day == "" {
		b.Day = time.Now().Format("2006-01-02")
	}
	if b.Color == "" {
		b.Color = "cyan"
	}
	if b.ID == "" {
		b.ID = newID("tb_")
		_, err := s.store().DB.Exec(
			`INSERT INTO time_blocks(id,day,label,start,end,color) VALUES(?,?,?,?,?,?)`,
			b.ID, b.Day, b.Label, b.Start, b.End, b.Color)
		if err != nil {
			return nil, err
		}
	} else {
		_, err := s.store().DB.Exec(
			`UPDATE time_blocks SET day=?,label=?,start=?,end=?,color=? WHERE id=?`,
			b.Day, b.Label, b.Start, b.End, b.Color, b.ID)
		if err != nil {
			return nil, err
		}
	}
	return &b, nil
}

func (s *TimeService) DeleteBlock(id string) error {
	_, err := s.store().DB.Exec(`DELETE FROM time_blocks WHERE id=?`, id)
	return err
}

func (s *TimeService) Blocks(day string) ([]TimeBlock, error) {
	if day == "" {
		day = time.Now().Format("2006-01-02")
	}
	rows, err := s.store().DB.Query(
		`SELECT id,day,label,start,end,color FROM time_blocks WHERE day=? ORDER BY start`, day)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []TimeBlock{}
	for rows.Next() {
		var b TimeBlock
		if err := rows.Scan(&b.ID, &b.Day, &b.Label, &b.Start, &b.End, &b.Color); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, nil
}

// ── foreground app tracking (Windows) ─────────────────────────────────

var (
	user32          = syscall.NewLazyDLL("user32.dll")
	pGetForeground  = user32.NewProc("GetForegroundWindow")
	pGetWindowTextW = user32.NewProc("GetWindowTextW")
	pGetClassNameW  = user32.NewProc("GetClassNameW")
)

// StartTracking begins polling the foreground window every 5s; each stop
// flushes accumulated seconds into app_usage as one row per app|title.
func (s *TimeService) StartTracking() error {
	s.trackMu.Lock()
	defer s.trackMu.Unlock()
	if s.trackStop != nil {
		return fmt.Errorf("tracking already running")
	}
	stop := make(chan struct{})
	s.trackStop = stop
	go func() {
		tick := time.NewTicker(5 * time.Second)
		defer tick.Stop()
		lastKey := ""
		lastAt := time.Now()
		flush := func(now time.Time) {
			if lastKey != "" {
				parts := strings.SplitN(lastKey, "|", 2)
				app, title := parts[0], ""
				if len(parts) > 1 {
					title = parts[1]
				}
				secs := int64(now.Sub(lastAt).Seconds())
				if secs >= 2 {
					_, _ = s.store().DB.Exec(
						`INSERT INTO app_usage(id,app_name,title,seconds,day) VALUES(?,?,?,?,?)`,
						newID("au_"), app, title, secs, lastAt.Format("2006-01-02"))
				}
			}
			lastAt = now
		}
		for {
			select {
			case <-stop:
				flush(time.Now())
				return
			case now := <-tick.C:
				key := foregroundKey()
				if key != lastKey {
					flush(now)
					lastKey = key
				}
			}
		}
	}()
	core.GlobalBus.Publish("time.tracking.started", nil)
	return nil
}

func (s *TimeService) StopTracking() error {
	s.trackMu.Lock()
	defer s.trackMu.Unlock()
	if s.trackStop == nil {
		return fmt.Errorf("tracking not running")
	}
	close(s.trackStop)
	s.trackStop = nil
	core.GlobalBus.Publish("time.tracking.stopped", nil)
	return nil
}

func (s *TimeService) TrackingOn() bool {
	s.trackMu.Lock()
	defer s.trackMu.Unlock()
	return s.trackStop != nil
}

// Usage returns today's per-app totals, largest first.
func (s *TimeService) Usage(day string) ([]map[string]interface{}, error) {
	if day == "" {
		day = time.Now().Format("2006-01-02")
	}
	rows, err := s.store().DB.Query(
		`SELECT app_name, MAX(COALESCE(title,'')), SUM(seconds) FROM app_usage WHERE day=? GROUP BY app_name ORDER BY 3 DESC`,
		day)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]interface{}{}
	for rows.Next() {
		var app, title string
		var secs int64
		_ = rows.Scan(&app, &title, &secs)
		out = append(out, map[string]interface{}{"app": app, "title": title, "seconds": secs})
	}
	return out, nil
}

func foregroundKey() string {
	hwnd, _, _ := pGetForeground.Call()
	if hwnd == 0 {
		return ""
	}
	buf := make([]uint16, 256)
	pGetWindowTextW.Call(hwnd, uintptr(unsafe.Pointer(&buf[0])), 256)
	title := strings.TrimSpace(syscall.UTF16ToString(buf))
	cls := make([]uint16, 128)
	pGetClassNameW.Call(hwnd, uintptr(unsafe.Pointer(&cls[0])), 128)
	app := strings.TrimSpace(syscall.UTF16ToString(cls))
	return app + "|" + title
}
