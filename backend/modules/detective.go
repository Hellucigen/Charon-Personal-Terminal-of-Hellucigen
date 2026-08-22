// Package modules — detective board: a red-string corkboard.
//
// Nodes carry a canvas position (x/y) so the frontend can render them on
// an SVG canvas; edges carry one of three relations (confirmed / suspect /
// ruled-out). A whole board exports as JSON for backup.
package modules

import (
	"encoding/json"
	"time"

	"personal-terminal/backend/core"
	"personal-terminal/backend/db"
)

type DetectiveNode struct {
	ID        string  `json:"id"`
	Kind      string  `json:"kind"` // person|place|event|evidence|theory
	Label     string  `json:"label"`
	Note      string  `json:"note"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	PinnedRef string  `json:"pinned_ref,omitempty"` // note id pinned to the board
	CreatedAt int64   `json:"created_at"`
}

type DetectiveEdge struct {
	ID       string `json:"id"`
	FromID   string `json:"from_id"`
	ToID     string `json:"to_id"`
	Relation string `json:"relation"` // confirmed|suspect|ruled-out
}

type DetectiveService struct{}

func NewDetectiveService() *DetectiveService { return &DetectiveService{} }
func (s *DetectiveService) store() *db.Store { return core.GlobalStore.(*db.Store) }

func (s *DetectiveService) SaveNode(n DetectiveNode) (*DetectiveNode, error) {
	if n.Label == "" {
		return nil, errRequired("label")
	}
	if n.Kind == "" {
		n.Kind = "person"
	}
	if n.ID == "" {
		n.ID = newID("dn_")
		n.CreatedAt = time.Now().Unix()
		if _, err := s.store().DB.Exec(
			`INSERT INTO detective_nodes(id,kind,label,note,x,y,pinned,created_at) VALUES(?,?,?,?,?,?,?,?)`,
			n.ID, n.Kind, n.Label, n.Note, n.X, n.Y, nullableStr(n.PinnedRef), n.CreatedAt); err != nil {
			return nil, err
		}
	} else {
		if _, err := s.store().DB.Exec(
			`UPDATE detective_nodes SET kind=?,label=?,note=?,x=?,y=?,pinned=? WHERE id=?`,
			n.Kind, n.Label, n.Note, n.X, n.Y, nullableStr(n.PinnedRef), n.ID); err != nil {
			return nil, err
		}
	}
	core.GlobalBus.Publish("detective.node.saved", map[string]interface{}{"id": n.ID})
	return &n, nil
}

// Move updates only the canvas position — called continuously while dragging.
func (s *DetectiveService) Move(id string, x, y float64) error {
	_, err := s.store().DB.Exec(`UPDATE detective_nodes SET x=?,y=? WHERE id=?`, x, y, id)
	return err
}

func (s *DetectiveService) DeleteNode(id string) error {
	if _, err := s.store().DB.Exec(`DELETE FROM detective_edges WHERE from_id=? OR to_id=?`, id, id); err != nil {
		return err
	}
	_, err := s.store().DB.Exec(`DELETE FROM detective_nodes WHERE id=?`, id)
	core.GlobalBus.Publish("detective.node.deleted", map[string]interface{}{"id": id})
	return err
}

func (s *DetectiveService) AddEdge(from, to, relation string) (*DetectiveEdge, error) {
	if relation == "" {
		relation = "suspect"
	}
	e := &DetectiveEdge{ID: newID("de_"), FromID: from, ToID: to, Relation: relation}
	if _, err := s.store().DB.Exec(
		`INSERT INTO detective_edges(id,from_id,to_id,relation) VALUES(?,?,?,?)`,
		e.ID, e.FromID, e.ToID, e.Relation); err != nil {
		return nil, err
	}
	return e, nil
}

func (s *DetectiveService) DeleteEdge(id string) error {
	_, err := s.store().DB.Exec(`DELETE FROM detective_edges WHERE id=?`, id)
	return err
}

// Board returns every node and edge on the board.
func (s *DetectiveService) Board() (map[string]interface{}, error) {
	nodes := []DetectiveNode{}
	rows, err := s.store().DB.Query(`SELECT id,kind,label,note,x,y,COALESCE(pinned,''),created_at FROM detective_nodes ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var n DetectiveNode
		if err := rows.Scan(&n.ID, &n.Kind, &n.Label, &n.Note, &n.X, &n.Y, &n.PinnedRef, &n.CreatedAt); err != nil {
			rows.Close()
			return nil, err
		}
		nodes = append(nodes, n)
	}
	rows.Close()

	edges := []DetectiveEdge{}
	rows, err = s.store().DB.Query(`SELECT id,from_id,to_id,relation FROM detective_edges`)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var e DetectiveEdge
		if err := rows.Scan(&e.ID, &e.FromID, &e.ToID, &e.Relation); err != nil {
			rows.Close()
			return nil, err
		}
		edges = append(edges, e)
	}
	rows.Close()
	return map[string]interface{}{"nodes": nodes, "edges": edges}, nil
}

// Export dumps the board as a pretty JSON string.
func (s *DetectiveService) Export() (string, error) {
	board, err := s.Board()
	if err != nil {
		return "", err
	}
	b, err := json.MarshalIndent(board, "", "  ")
	return string(b), err
}
