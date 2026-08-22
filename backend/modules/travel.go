// Package modules — travel log: trips and daily entries with an optional
// GPS point per entry, plus per-trip spending that feeds Finance.
package modules

import (
	"encoding/json"
	"time"

	"personal-terminal/backend/core"
	"personal-terminal/backend/db"
)

type Trip struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	StartAt   int64  `json:"start_at"`
	EndAt     int64  `json:"end_at,omitempty"`
	Note      string `json:"note"`
	CreatedAt int64  `json:"created_at"`
}

type TravelEntry struct {
	ID       string   `json:"id"`
	TripID   string   `json:"trip_id"`
	Title    string   `json:"title"`
	Body     string   `json:"body"`
	Mood     int      `json:"mood"`
	Spend    float64  `json:"spend"`
	Lat      *float64 `json:"lat,omitempty"`
	Lng      *float64 `json:"lng,omitempty"`
	Photos   []string `json:"photos"`
	LoggedAt int64    `json:"logged_at"`
}

type TravelService struct{}

func NewTravelService() *TravelService { return &TravelService{} }
func (s *TravelService) store() *db.Store { return core.GlobalStore.(*db.Store) }

func (s *TravelService) SaveTrip(t Trip) (*Trip, error) {
	if t.Title == "" {
		return nil, errRequired("title")
	}
	if t.StartAt == 0 {
		t.StartAt = time.Now().Unix()
	}
	if t.ID == "" {
		t.ID = newID("tr_")
		t.CreatedAt = time.Now().Unix()
		_, err := s.store().DB.Exec(
			`INSERT INTO travel_trips(id,title,start_at,end_at,note,created_at) VALUES(?,?,?,?,?,?)`,
			t.ID, t.Title, t.StartAt, nullableI64(t.EndAt), t.Note, t.CreatedAt)
		if err != nil {
			return nil, err
		}
	} else {
		_, err := s.store().DB.Exec(
			`UPDATE travel_trips SET title=?,start_at=?,end_at=?,note=? WHERE id=?`,
			t.Title, t.StartAt, nullableI64(t.EndAt), t.Note, t.ID)
		if err != nil {
			return nil, err
		}
	}
	return &t, nil
}

func (s *TravelService) DeleteTrip(id string) error {
	if _, err := s.store().DB.Exec(`DELETE FROM travel_entries WHERE trip_id=?`, id); err != nil {
		return err
	}
	_, err := s.store().DB.Exec(`DELETE FROM travel_trips WHERE id=?`, id)
	return err
}

func (s *TravelService) Trips() ([]Trip, error) {
	rows, err := s.store().DB.Query(`SELECT id,title,start_at,COALESCE(end_at,0),note,created_at FROM travel_trips ORDER BY start_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Trip{}
	for rows.Next() {
		var t Trip
		if err := rows.Scan(&t.ID, &t.Title, &t.StartAt, &t.EndAt, &t.Note, &t.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, nil
}

func (s *TravelService) SaveEntry(e TravelEntry) (*TravelEntry, error) {
	if e.TripID == "" {
		return nil, errRequired("trip_id")
	}
	if e.LoggedAt == 0 {
		e.LoggedAt = time.Now().Unix()
	}
	if e.Photos == nil {
		e.Photos = []string{}
	}
	photos, _ := json.Marshal(e.Photos)
	if e.ID == "" {
		e.ID = newID("te_")
		_, err := s.store().DB.Exec(
			`INSERT INTO travel_entries(id,trip_id,title,body,mood,spend,lat,lng,photos,logged_at)
			 VALUES(?,?,?,?,?,?,?,?,?,?)`,
			e.ID, e.TripID, e.Title, e.Body, e.Mood, e.Spend,
			nullableF64(e.Lat), nullableF64(e.Lng), string(photos), e.LoggedAt)
		if err != nil {
			return nil, err
		}
	} else {
		_, err := s.store().DB.Exec(
			`UPDATE travel_entries SET title=?,body=?,mood=?,spend=?,lat=?,lng=?,photos=?,logged_at=? WHERE id=?`,
			e.Title, e.Body, e.Mood, e.Spend, nullableF64(e.Lat), nullableF64(e.Lng), string(photos), e.LoggedAt, e.ID)
		if err != nil {
			return nil, err
		}
	}
	// Travel spending flows into Finance as an expense.
	if e.Spend > 0 {
		_, _ = (&FinanceService{}).SaveTransaction(Transaction{
			Amount: -e.Spend, Category: "travel", Note: "trip " + e.TripID,
			OccurredAt: e.LoggedAt, Source: "travel",
		})
	}
	core.GlobalBus.Publish("travel.entry.saved", map[string]interface{}{"id": e.ID})
	return &e, nil
}

func (s *TravelService) DeleteEntry(id string) error {
	_, err := s.store().DB.Exec(`DELETE FROM travel_entries WHERE id=?`, id)
	return err
}

func (s *TravelService) Entries(tripID string) ([]TravelEntry, error) {
	rows, err := s.store().DB.Query(
		`SELECT id,trip_id,title,body,mood,spend,lat,lng,photos,logged_at
		 FROM travel_entries WHERE trip_id=? ORDER BY logged_at`, tripID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []TravelEntry{}
	for rows.Next() {
		var e TravelEntry
		var photosRaw string
		if err := rows.Scan(&e.ID, &e.TripID, &e.Title, &e.Body, &e.Mood, &e.Spend,
			&e.Lat, &e.Lng, &photosRaw, &e.LoggedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal([]byte(photosRaw), &e.Photos)
		if e.Photos == nil {
			e.Photos = []string{}
		}
		out = append(out, e)
	}
	return out, nil
}

func nullableF64(v *float64) interface{} {
	if v == nil {
		return nil
	}
	return *v
}
