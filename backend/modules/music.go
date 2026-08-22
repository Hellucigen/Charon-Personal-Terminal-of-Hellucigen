// Package modules — music & podcasts: scans a local folder for audio
// files, manages podcast RSS subscriptions, and opens playback in the
// system player (the webview sandbox can't stream arbitrary local files).
package modules

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"personal-terminal/backend/core"
	"personal-terminal/backend/db"
)

type Track struct {
	Path  string `json:"path"`
	Name  string `json:"name"`
	Artist string `json:"artist,omitempty"`
	Ext   string `json:"ext"`
	Size  int64  `json:"size"`
}

type Episode struct {
	Title string `json:"title"`
	URL   string `json:"url"`
	Date  string `json:"date,omitempty"`
}

type Podcast struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	URL       string    `json:"url"`
	LastFetch int64     `json:"last_fetch"`
	Episodes  []Episode `json:"episodes"`
	CreatedAt int64     `json:"created_at"`
}

type MusicService struct{}

func NewMusicService() *MusicService { return &MusicService{} }
func (s *MusicService) store() *db.Store { return core.GlobalStore.(*db.Store) }

var audioExts = map[string]bool{".mp3": true, ".flac": true, ".m4a": true, ".wav": true, ".ogg": true, ".opus": true}

// Scan walks a folder (non-recursive beyond depth 3) for audio files.
func (s *MusicService) Scan(dir string) ([]Track, error) {
	if dir == "" {
		return nil, errRequired("dir")
	}
	if _, err := os.Stat(dir); err != nil {
		return nil, fmt.Errorf("folder not found: %w", err)
	}
	out := []Track{}
	base := dir
	_ = filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			rel, _ := filepath.Rel(base, path)
			if rel != "." && strings.Count(rel, string(filepath.Separator)) >= 2 {
				return filepath.SkipDir
			}
			return nil
		}
		ext := strings.ToLower(filepath.Ext(path))
		if !audioExts[ext] {
			return nil
		}
		name := strings.TrimSuffix(info.Name(), filepath.Ext(info.Name()))
		artist := ""
		if i := strings.Index(name, " - "); i > 0 {
			artist, name = name[:i], name[i+3:]
		}
		out = append(out, Track{Path: path, Name: name, Artist: artist, Ext: ext, Size: info.Size()})
		return nil
	})
	return out, nil
}

// Play opens the file (or URL, for podcast episodes) with the OS default
// handler; reveal opens Explorer at the file's location.
func (s *MusicService) Play(path, action string) error {
	if action == "" {
		action = "play"
	}
	isURL := strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://")
	if !isURL {
		if _, err := os.Stat(path); err != nil {
			return err
		}
	}
	if action == "reveal" {
		if isURL {
			return fmt.Errorf("reveal is only for local files")
		}
		return revealInExplorer(path)
	}
	cmd := exec.Command("cmd", "/c", "start", "", path)
	return cmd.Start()
}

// ── podcasts ───────────────────────────────────────────────────────────

type rssFeed struct {
	Title string    `xml:"channel>title"`
	Items []rssItem `xml:"channel>item"`
}

type rssItem struct {
	Title     string `xml:"title"`
	Link      string `xml:"link"`
	PubDate   string `xml:"pubDate"`
	Enclosure struct {
		URL string `xml:"url,attr"`
	} `xml:"enclosure"`
}

func (s *MusicService) AddPodcast(title, url string) (*Podcast, error) {
	if url == "" {
		return nil, errRequired("url")
	}
	if title == "" {
		title = url
	}
	p := &Podcast{ID: newID("pc_"), Title: title, URL: url, CreatedAt: time.Now().Unix(), Episodes: []Episode{}}
	if _, err := s.store().DB.Exec(
		`INSERT INTO podcasts(id,title,url,last_fetch,episodes,created_at) VALUES(?,?,?,?,?,?)`,
		p.ID, p.Title, p.URL, 0, "[]", p.CreatedAt); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *MusicService) DeletePodcast(id string) error {
	_, err := s.store().DB.Exec(`DELETE FROM podcasts WHERE id=?`, id)
	return err
}

func (s *MusicService) Podcasts() ([]Podcast, error) {
	rows, err := s.store().DB.Query(`SELECT id,title,url,COALESCE(last_fetch,0),episodes,created_at FROM podcasts ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Podcast{}
	for rows.Next() {
		var p Podcast
		var eps string
		if err := rows.Scan(&p.ID, &p.Title, &p.URL, &p.LastFetch, &eps, &p.CreatedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal([]byte(eps), &p.Episodes)
		if p.Episodes == nil {
			p.Episodes = []Episode{}
		}
		out = append(out, p)
	}
	return out, nil
}

// Refresh fetches one RSS feed and stores its latest episodes.
func (s *MusicService) Refresh(id string) (*Podcast, error) {
	var p Podcast
	var epsRaw string
	err := s.store().DB.QueryRow(`SELECT id,title,url,COALESCE(last_fetch,0),episodes,created_at FROM podcasts WHERE id=?`, id).
		Scan(&p.ID, &p.Title, &p.URL, &p.LastFetch, &epsRaw, &p.CreatedAt)
	if err != nil {
		return nil, err
	}
	c := http.Client{Timeout: 15 * time.Second}
	resp, err := c.Get(p.URL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))

	var feed rssFeed
	if err := xml.Unmarshal(body, &feed); err != nil {
		return nil, fmt.Errorf("bad RSS: %w", err)
	}
	if feed.Title != "" && p.Title == p.URL {
		p.Title = feed.Title
	}
	p.Episodes = []Episode{}
	for i, item := range feed.Items {
		if i >= 50 {
			break
		}
		url := item.Enclosure.URL
		if url == "" {
			url = item.Link
		}
		if url == "" {
			continue
		}
		p.Episodes = append(p.Episodes, Episode{Title: item.Title, URL: url, Date: item.PubDate})
	}
	p.LastFetch = time.Now().Unix()
	eps, _ := json.Marshal(p.Episodes)
	if _, err := s.store().DB.Exec(
		`UPDATE podcasts SET title=?,last_fetch=?,episodes=? WHERE id=?`,
		p.Title, p.LastFetch, eps, p.ID); err != nil {
		return nil, err
	}
	core.GlobalBus.Publish("music.podcast.refreshed", map[string]interface{}{"id": id})
	return &p, nil
}

func revealInExplorer(path string) error {
	cmd := exec.Command("explorer", "/select,", path)
	return cmd.Start()
}
