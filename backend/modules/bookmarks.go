package modules

import (
	"encoding/json"
	"os"
	"regexp"
	"strings"
	"time"

	"personal-terminal/backend/core"
	"personal-terminal/backend/db"
)

type Bookmark struct {
	ID        string   `json:"id"`
	Title     string   `json:"title"`
	URL       string   `json:"url"`
	Folder    string   `json:"folder"`
	Tags      []string `json:"tags"`
	Snapshot  string   `json:"snapshot,omitempty"` // path to page screenshot
	Dead      bool     `json:"dead"`
	LastCheck int64    `json:"last_check,omitempty"`
	CreatedAt int64    `json:"created_at"`
}

type BookmarksService struct{}

func NewBookmarksService() *BookmarksService { return &BookmarksService{} }
func (s *BookmarksService) store() *db.Store { return core.GlobalStore.(*db.Store) }

func (s *BookmarksService) Add(b Bookmark) (*Bookmark, error) {
	if b.Tags == nil {
		b.Tags = []string{}
	}
	b.ID = newID("b_")
	b.CreatedAt = time.Now().Unix()
	tags, _ := json.Marshal(b.Tags)
	_, err := s.store().DB.Exec(
		`INSERT INTO bookmarks(id,title,url,folder,tags,snapshot,dead,created_at)
		 VALUES(?,?,?,?,?,?,0,?)`,
		b.ID, b.Title, b.URL, b.Folder, string(tags), nullableStr(b.Snapshot), b.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (s *BookmarksService) Delete(id string) error {
	_, err := s.store().DB.Exec(`DELETE FROM bookmarks WHERE id=?`, id)
	return err
}

func (s *BookmarksService) List(folder string) ([]Bookmark, error) {
	q := `SELECT id,title,url,folder,tags,COALESCE(snapshot,''),dead,COALESCE(last_check,0),created_at
	      FROM bookmarks`
	args := []any{}
	if folder != "" {
		q += ` WHERE folder=?`
		args = append(args, folder)
	}
	q += ` ORDER BY folder, title`
	rows, err := s.store().DB.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Bookmark{}
	for rows.Next() {
		var b Bookmark
		var tagsRaw string
		var dead int
		if err := rows.Scan(&b.ID, &b.Title, &b.URL, &b.Folder, &tagsRaw, &b.Snapshot,
			&dead, &b.LastCheck, &b.CreatedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal([]byte(tagsRaw), &b.Tags)
		if b.Tags == nil {
			b.Tags = []string{}
		}
		b.Dead = dead == 1
		out = append(out, b)
	}
	return out, nil
}

// ImportEdgeHTML parses a Netscape-format bookmarks file exported from
// Microsoft Edge or any Chromium browser. Folder hierarchy is preserved
// as a "Bookmarks Bar/Tech/AI" style path string.
func (s *BookmarksService) ImportEdgeHTML(path string) (int, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return 0, err
	}
	html := string(data)
	// Walk the doc, tracking the current folder breadcrumb.
	folderRE := regexp.MustCompile(`(?i)<DT><H3[^>]*>([^<]+)</H3>`)
	bookmarkRE := regexp.MustCompile(`(?i)<DT><A HREF="([^"]+)"[^>]*>([^<]+)</A>`)
	endRE := regexp.MustCompile(`(?i)</DL>`)

	stack := []string{}
	count := 0
	// Simple positional scan: each line carries at most one interesting token.
	for _, line := range strings.Split(html, "\n") {
		if m := folderRE.FindStringSubmatch(line); m != nil {
			stack = append(stack, strings.TrimSpace(m[1]))
			continue
		}
		if endRE.MatchString(line) && len(stack) > 0 {
			stack = stack[:len(stack)-1]
			continue
		}
		if m := bookmarkRE.FindStringSubmatch(line); m != nil {
			b := Bookmark{
				Title:  strings.TrimSpace(m[2]),
				URL:    strings.TrimSpace(m[1]),
				Folder: strings.Join(stack, "/"),
				Tags:   []string{},
			}
			if _, err := s.Add(b); err == nil {
				count++
			}
		}
	}
	core.GlobalBus.Publish("bookmarks.imported", map[string]interface{}{"count": count})
	return count, nil
}
