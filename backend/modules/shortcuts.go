package modules

import (
	"os/exec"
	"runtime"
	"strings"
	"time"

	"personal-terminal/backend/core"
	"personal-terminal/backend/db"
)

type Shortcut struct {
	ID        string `json:"id"`
	Label     string `json:"label"`
	Target    string `json:"target"` // absolute path, URL, or shell command
	GroupID   string `json:"group_id,omitempty"`
	Icon      string `json:"icon,omitempty"`
	Pinned    bool   `json:"pinned"`
	OpenCount int    `json:"open_count"`
	LastOpen  int64  `json:"last_open,omitempty"`
	CreatedAt int64  `json:"created_at"`
}

type ShortcutsService struct{}

func NewShortcutsService() *ShortcutsService { return &ShortcutsService{} }
func (s *ShortcutsService) store() *db.Store { return core.GlobalStore.(*db.Store) }

func (s *ShortcutsService) Add(sc Shortcut) (*Shortcut, error) {
	sc.ID = newID("s_")
	sc.CreatedAt = time.Now().Unix()
	pinned := 0
	if sc.Pinned {
		pinned = 1
	}
	_, err := s.store().DB.Exec(
		`INSERT INTO shortcuts(id,label,target,group_id,icon,pinned,open_count,created_at)
		 VALUES(?,?,?,?,?,?,0,?)`,
		sc.ID, sc.Label, sc.Target, nullableStr(sc.GroupID), nullableStr(sc.Icon), pinned, sc.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &sc, nil
}

func (s *ShortcutsService) Delete(id string) error {
	_, err := s.store().DB.Exec(`DELETE FROM shortcuts WHERE id=?`, id)
	return err
}

func (s *ShortcutsService) List() ([]Shortcut, error) {
	rows, err := s.store().DB.Query(
		`SELECT id,label,target,COALESCE(group_id,''),COALESCE(icon,''),pinned,open_count,
		COALESCE(last_open,0),created_at FROM shortcuts ORDER BY pinned DESC, open_count DESC, label`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Shortcut{}
	for rows.Next() {
		var sc Shortcut
		var pinned int
		if err := rows.Scan(&sc.ID, &sc.Label, &sc.Target, &sc.GroupID, &sc.Icon,
			&pinned, &sc.OpenCount, &sc.LastOpen, &sc.CreatedAt); err != nil {
			return nil, err
		}
		sc.Pinned = pinned == 1
		out = append(out, sc)
	}
	return out, nil
}

// Open dispatches to the OS opener. Targets may be a file path, URL, or
// custom protocol; behavior depends on the platform.
func (s *ShortcutsService) Open(id string) error {
	var target string
	if err := s.store().DB.QueryRow(`SELECT target FROM shortcuts WHERE id=?`, id).Scan(&target); err != nil {
		return err
	}
	if err := openOS(target); err != nil {
		return err
	}
	_, _ = s.store().DB.Exec(
		`UPDATE shortcuts SET open_count=open_count+1, last_open=? WHERE id=?`,
		time.Now().Unix(), id)
	return nil
}

// OpenInExplorer / OpenInTerminal / OpenInVSCode are convenience targets
// used by the per-row dropdown menu.
func (s *ShortcutsService) OpenInExplorer(id string) error {
	t, err := s.targetOf(id)
	if err != nil {
		return err
	}
	switch runtime.GOOS {
	case "windows":
		return exec.Command("explorer", t).Run()
	case "darwin":
		return exec.Command("open", t).Run()
	default:
		return exec.Command("xdg-open", t).Run()
	}
}

func (s *ShortcutsService) OpenInTerminal(id string) error {
	t, err := s.targetOf(id)
	if err != nil {
		return err
	}
	switch runtime.GOOS {
	case "windows":
		return exec.Command("cmd", "/C", "start", "wt.exe", "-d", t).Run()
	case "darwin":
		return exec.Command("open", "-a", "Terminal", t).Run()
	default:
		return exec.Command("x-terminal-emulator", "--working-directory="+t).Run()
	}
}

func (s *ShortcutsService) OpenInVSCode(id string) error {
	t, err := s.targetOf(id)
	if err != nil {
		return err
	}
	return exec.Command("code", t).Run()
}

func (s *ShortcutsService) targetOf(id string) (string, error) {
	var t string
	if err := s.store().DB.QueryRow(`SELECT target FROM shortcuts WHERE id=?`, id).Scan(&t); err != nil {
		return "", err
	}
	return t, nil
}

func openOS(target string) error {
	switch runtime.GOOS {
	case "windows":
		// "" arg ensures spaces are handled
		return exec.Command("cmd", "/C", "start", "", target).Run()
	case "darwin":
		return exec.Command("open", target).Run()
	default:
		if strings.HasPrefix(target, "http") {
			return exec.Command("xdg-open", target).Run()
		}
		return exec.Command("xdg-open", target).Run()
	}
}
