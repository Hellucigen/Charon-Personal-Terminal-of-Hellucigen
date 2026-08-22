// Package modules — Institute: a Fallout-4-Institute-flavoured "company of
// one". Departments are the functions of your far-future self, actions the
// things currently in motion, phases the milestones on the way.
package modules

import (
	"encoding/json"
	"time"

	"personal-terminal/backend/core"
	"personal-terminal/backend/db"
)

type Department struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Function  string `json:"function"`
	Vision    string `json:"vision"`
	Color     string `json:"color"`
	SortOrder int    `json:"sort_order"`
	CreatedAt int64  `json:"created_at"`
}

type InstAction struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	DeptID    string `json:"dept_id"`
	Status    string `json:"status"` // active|hold|done
	Progress  int    `json:"progress"`
	Note      string `json:"note"`
	UpdatedAt int64  `json:"updated_at"`
}

type Phase struct {
	ID         string      `json:"id"`
	Title      string      `json:"title"`
	DeptID     string      `json:"dept_id"`
	StartAt    int64       `json:"start_at,omitempty"`
	EndAt      int64       `json:"end_at,omitempty"`
	Milestones []string    `json:"milestones"`
	Done       bool        `json:"done"`
	Retro      string      `json:"retro"`
	CreatedAt  int64       `json:"created_at"`
}

type InstituteService struct{}

func NewInstituteService() *InstituteService { return &InstituteService{} }
func (s *InstituteService) store() *db.Store { return core.GlobalStore.(*db.Store) }

// ── departments ────────────────────────────────────────────────────────

func (s *InstituteService) SaveDept(d Department) (*Department, error) {
	if d.Name == "" {
		return nil, errRequired("name")
	}
	if d.Color == "" {
		d.Color = "cyan"
	}
	if d.ID == "" {
		d.ID = newID("id_")
		d.CreatedAt = time.Now().Unix()
		_, err := s.store().DB.Exec(
			`INSERT INTO institute_departments(id,name,function,vision,color,sort_order,created_at)
			 VALUES(?,?,?,?,?,?,?)`,
			d.ID, d.Name, d.Function, d.Vision, d.Color, d.SortOrder, d.CreatedAt)
		if err != nil {
			return nil, err
		}
	} else {
		_, err := s.store().DB.Exec(
			`UPDATE institute_departments SET name=?,function=?,vision=?,color=?,sort_order=? WHERE id=?`,
			d.Name, d.Function, d.Vision, d.Color, d.SortOrder, d.ID)
		if err != nil {
			return nil, err
		}
	}
	return &d, nil
}

func (s *InstituteService) DeleteDept(id string) error {
	_, err := s.store().DB.Exec(`DELETE FROM institute_departments WHERE id=?`, id)
	return err
}

func (s *InstituteService) Depts() ([]Department, error) {
	rows, err := s.store().DB.Query(
		`SELECT id,name,function,vision,color,sort_order,created_at FROM institute_departments ORDER BY sort_order, created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Department{}
	for rows.Next() {
		var d Department
		if err := rows.Scan(&d.ID, &d.Name, &d.Function, &d.Vision, &d.Color, &d.SortOrder, &d.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, nil
}

// ── actions ────────────────────────────────────────────────────────────

func (s *InstituteService) SaveAction(a InstAction) (*InstAction, error) {
	if a.Title == "" {
		return nil, errRequired("title")
	}
	if a.Status == "" {
		a.Status = "active"
	}
	a.UpdatedAt = time.Now().Unix()
	if a.ID == "" {
		a.ID = newID("ia_")
		_, err := s.store().DB.Exec(
			`INSERT INTO institute_actions(id,title,dept_id,status,progress,note,updated_at) VALUES(?,?,?,?,?,?,?)`,
			a.ID, a.Title, a.DeptID, a.Status, a.Progress, a.Note, a.UpdatedAt)
		if err != nil {
			return nil, err
		}
	} else {
		_, err := s.store().DB.Exec(
			`UPDATE institute_actions SET title=?,dept_id=?,status=?,progress=?,note=?,updated_at=? WHERE id=?`,
			a.Title, a.DeptID, a.Status, a.Progress, a.Note, a.UpdatedAt, a.ID)
		if err != nil {
			return nil, err
		}
	}
	if a.Status == "done" {
		awardXP(20, "institute.action:"+a.ID, "create")
	}
	return &a, nil
}

func (s *InstituteService) DeleteAction(id string) error {
	_, err := s.store().DB.Exec(`DELETE FROM institute_actions WHERE id=?`, id)
	return err
}

func (s *InstituteService) Actions(deptID string) ([]InstAction, error) {
	q := `SELECT id,title,dept_id,status,progress,note,updated_at FROM institute_actions`
	if deptID == "" {
		return s.queryActions(q + ` ORDER BY updated_at DESC`)
	}
	return s.queryActions(q+` WHERE dept_id=? ORDER BY updated_at DESC`, deptID)
}

func (s *InstituteService) queryActions(q string, args ...interface{}) ([]InstAction, error) {
	rows, err := s.store().DB.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []InstAction{}
	for rows.Next() {
		var a InstAction
		if err := rows.Scan(&a.ID, &a.Title, &a.DeptID, &a.Status, &a.Progress, &a.Note, &a.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, nil
}

// ── phases ─────────────────────────────────────────────────────────────

func (s *InstituteService) SavePhase(p Phase) (*Phase, error) {
	if p.Title == "" {
		return nil, errRequired("title")
	}
	if p.Milestones == nil {
		p.Milestones = []string{}
	}
	ms, _ := json.Marshal(p.Milestones)
	done := 0
	if p.Done {
		done = 1
	}
	if p.ID == "" {
		p.ID = newID("ip_")
		p.CreatedAt = time.Now().Unix()
		_, err := s.store().DB.Exec(
			`INSERT INTO institute_phases(id,title,dept_id,start_at,end_at,milestones,done,retro,created_at)
			 VALUES(?,?,?,?,?,?,?,?,?)`,
			p.ID, p.Title, p.DeptID, nullableI64(p.StartAt), nullableI64(p.EndAt), string(ms), done, p.Retro, p.CreatedAt)
		if err != nil {
			return nil, err
		}
	} else {
		_, err := s.store().DB.Exec(
			`UPDATE institute_phases SET title=?,dept_id=?,start_at=?,end_at=?,milestones=?,done=?,retro=? WHERE id=?`,
			p.Title, p.DeptID, nullableI64(p.StartAt), nullableI64(p.EndAt), string(ms), done, p.Retro, p.ID)
		if err != nil {
			return nil, err
		}
	}
	return &p, nil
}

func (s *InstituteService) DeletePhase(id string) error {
	_, err := s.store().DB.Exec(`DELETE FROM institute_phases WHERE id=?`, id)
	return err
}

func (s *InstituteService) Phases(deptID string) ([]Phase, error) {
	q := `SELECT id,title,dept_id,COALESCE(start_at,0),COALESCE(end_at,0),milestones,done,retro,created_at FROM institute_phases`
	if deptID == "" {
		return s.queryPhases(q + ` ORDER BY start_at`)
	}
	return s.queryPhases(q+` WHERE dept_id=? ORDER BY start_at`, deptID)
}

func (s *InstituteService) queryPhases(q string, args ...interface{}) ([]Phase, error) {
	rows, err := s.store().DB.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Phase{}
	for rows.Next() {
		var p Phase
		var msRaw string
		var done int
		if err := rows.Scan(&p.ID, &p.Title, &p.DeptID, &p.StartAt, &p.EndAt, &msRaw, &done, &p.Retro, &p.CreatedAt); err != nil {
			return nil, err
		}
		p.Done = done == 1
		_ = json.Unmarshal([]byte(msRaw), &p.Milestones)
		if p.Milestones == nil {
			p.Milestones = []string{}
		}
		out = append(out, p)
	}
	return out, nil
}
