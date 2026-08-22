// Package modules — password vault.
//
// Entries are encrypted with AES-256-GCM. The key is derived from a master
// passphrase with PBKDF2-HMAC-SHA256 (210k iterations). Only the verifier
// hash is stored; the master passphrase and derived key never touch disk.
package modules

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/csv"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"golang.org/x/crypto/pbkdf2"

	"personal-terminal/backend/core"
	"personal-terminal/backend/db"
)

type PasswordEntry struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	URL       string `json:"url,omitempty"`
	Username  string `json:"username,omitempty"`
	Password  string `json:"password,omitempty"` // decrypted, only in-memory / on demand
	Notes     string `json:"notes,omitempty"`
	Strength  int    `json:"strength"`
	Duplicate bool   `json:"duplicate"`
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `json:"updated_at"`
}

type PasswordService struct {
	key      []byte // derived while unlocked
	unlocked bool
	salt     []byte
	verifier []byte
}

func NewPasswordService() *PasswordService { return &PasswordService{} }
func (s *PasswordService) store() *db.Store { return core.GlobalStore.(*db.Store) }

const pbkdf2Iters = 210000

func (s *PasswordService) loadMeta() error {
	if s.salt != nil {
		return nil
	}
	row := s.store().DB.QueryRow(`SELECT value FROM vault_meta WHERE key='salt'`)
	var saltB64 string
	err := row.Scan(&saltB64)
	if err != nil {
		return err
	}
	salt, _ := base64.StdEncoding.DecodeString(saltB64)
	s.salt = salt
	row = s.store().DB.QueryRow(`SELECT value FROM vault_meta WHERE key='verifier'`)
	var verB64 string
	if err := row.Scan(&verB64); err == nil {
		v, _ := base64.StdEncoding.DecodeString(verB64)
		s.verifier = v
	}
	return nil
}

// Status reports whether a vault exists and is unlocked.
func (s *PasswordService) Status() map[string]interface{} {
	_, _ = s.store().DB.Exec(`CREATE TABLE IF NOT EXISTS vault_meta (key TEXT PRIMARY KEY, value TEXT)`)
	var one int
	_ = s.store().DB.QueryRow(`SELECT COUNT(*) FROM vault_meta`).Scan(&one)
	count, _ := s.countEntries()
	return map[string]interface{}{"created": one > 0, "unlocked": s.unlocked, "entries": count}
}

func (s *PasswordService) countEntries() (int, error) {
	var n int
	err := s.store().DB.QueryRow(`SELECT COUNT(*) FROM passwords`).Scan(&n)
	return n, err
}

// Init creates a new vault protected by the given master passphrase.
func (s *PasswordService) Init(master string) error {
	if master == "" {
		return fmt.Errorf("master passphrase cannot be empty")
	}
	_, _ = s.store().DB.Exec(`CREATE TABLE IF NOT EXISTS vault_meta (key TEXT PRIMARY KEY, value TEXT)`)
	var one int
	_ = s.store().DB.QueryRow(`SELECT COUNT(*) FROM vault_meta`).Scan(&one)
	if one > 0 {
		return fmt.Errorf("vault already exists")
	}
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return err
	}
	key := pbkdf2.Key([]byte(master), salt, pbkdf2Iters, 32, sha256.New)
	ver := sha256.Sum256(key)
	if _, err := s.store().DB.Exec(
		`INSERT INTO vault_meta(key,value) VALUES('salt',?), ('verifier',?)`,
		base64.StdEncoding.EncodeToString(salt),
		base64.StdEncoding.EncodeToString(ver[:])); err != nil {
		return err
	}
	s.salt, s.verifier, s.key, s.unlocked = salt, ver[:], key, true
	return nil
}

// Unlock derives the key from the passphrase and checks it against the
// stored verifier. A bad passphrase returns an error and leaves the
// vault locked.
func (s *PasswordService) Unlock(master string) (bool, error) {
	if err := s.loadMeta(); err != nil {
		return false, fmt.Errorf("vault not found — create it first")
	}
	key := pbkdf2.Key([]byte(master), s.salt, pbkdf2Iters, 32, sha256.New)
	ver := sha256.Sum256(key)
	if subtle.ConstantTimeCompare(ver[:], s.verifier) != 1 {
		return false, fmt.Errorf("wrong master passphrase")
	}
	s.key, s.unlocked = key, true
	return true, nil
}

func (s *PasswordService) Lock() { s.key, s.unlocked = nil, false }

func (s *PasswordService) aead() (cipher.AEAD, error) {
	if !s.unlocked || s.key == nil {
		return nil, fmt.Errorf("vault is locked")
	}
 blk, err := aes.NewCipher(s.key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(blk)
}

func (s *PasswordService) encrypt(plain string) (nonce, ct []byte, err error) {
	a, err := s.aead()
	if err != nil {
		return nil, nil, err
	}
	nonce = make([]byte, a.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, nil, err
	}
	ct = a.Seal(nil, nonce, []byte(plain), nil)
	return nonce, ct, nil
}

func (s *PasswordService) decrypt(nonce, ct []byte) (string, error) {
	a, err := s.aead()
	if err != nil {
		return "", err
	}
	pt, err := a.Open(nil, nonce, ct, nil)
	if err != nil {
		return "", fmt.Errorf("decrypt failed (wrong key?)")
	}
	return string(pt), nil
}

// Save creates or updates an entry; the secret is encrypted before storage.
func (s *PasswordService) Save(e PasswordEntry) (*PasswordEntry, error) {
	if e.Name == "" {
		return nil, fmt.Errorf("name is required")
	}
	secret := e.Password + "\x00" + e.Notes
	nonce, ct, err := s.encrypt(secret)
	if err != nil {
		return nil, err
	}
	e.Strength = passwordStrength(e.Password)
	e.UpdatedAt = time.Now().Unix()
	if e.ID == "" {
		e.ID = newID("pw_")
		e.CreatedAt = e.UpdatedAt
		_, err = s.store().DB.Exec(
			`INSERT INTO passwords(id,name,url,username,cipher,nonce,strength,created_at,updated_at)
			 VALUES(?,?,?,?,?,?,?,?,?)`,
			e.ID, e.Name, nullableStr(e.URL), nullableStr(e.Username), ct, nonce, e.Strength, e.CreatedAt, e.UpdatedAt)
	} else {
		_, err = s.store().DB.Exec(
			`UPDATE passwords SET name=?,url=?,username=?,cipher=?,nonce=?,strength=?,updated_at=? WHERE id=?`,
			e.Name, nullableStr(e.URL), nullableStr(e.Username), ct, nonce, e.Strength, e.UpdatedAt, e.ID)
	}
	if err != nil {
		return nil, err
	}
	e.Password = ""
	core.GlobalBus.Publish("passwords.saved", map[string]interface{}{"id": e.ID})
	return &e, nil
}

// List returns entries without secrets; reveal is a separate, deliberate call.
func (s *PasswordService) List() ([]PasswordEntry, error) {
	rows, err := s.store().DB.Query(
		`SELECT id,name,COALESCE(url,''),COALESCE(username,''),strength,created_at,updated_at FROM passwords ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []PasswordEntry{}
	seenUser := map[string]int{}
	for rows.Next() {
		var e PasswordEntry
		if err := rows.Scan(&e.ID, &e.Name, &e.URL, &e.Username, &e.Strength, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, err
		}
		if e.Username != "" {
			seenUser[e.Username+"|"+e.URL]++
		}
		out = append(out, e)
	}
	for i := range out {
		if out[i].Username != "" {
			out[i].Duplicate = seenUser[out[i].Username+"|"+out[i].URL] > 1
		}
	}
	return out, nil
}

// Reveal decrypts and returns the secret for one entry.
func (s *PasswordService) Reveal(id string) (map[string]string, error) {
	var nonce, ct []byte
	err := s.store().DB.QueryRow(`SELECT nonce,cipher FROM passwords WHERE id=?`, id).Scan(&nonce, &ct)
	if err != nil {
		return nil, err
	}
	plain, err := s.decrypt(nonce, ct)
	if err != nil {
		return nil, err
	}
	parts := strings.SplitN(plain, "\x00", 2)
	out := map[string]string{"password": parts[0]}
	if len(parts) > 1 {
		out["notes"] = parts[1]
	}
	return out, nil
}

func (s *PasswordService) Delete(id string) error {
	_, err := s.store().DB.Exec(`DELETE FROM passwords WHERE id=?`, id)
	return err
}

// ImportCSV accepts an Edge/Chrome password export (name,url,username,password)
// and encrypts each row into the vault. Returns the number imported.
func (s *PasswordService) ImportCSV(path string) (int, error) {
	f, err := os.Open(path)
	if err != nil {
		return 0, err
	}
	defer f.Close()
	r := csv.NewReader(f)
	r.FieldsPerRecord = -1
	header, err := r.Read()
	if err != nil {
		return 0, err
	}
	idx := map[string]int{}
	for i, h := range header {
		idx[strings.ToLower(strings.TrimSpace(h))] = i
	}
	get := func(row []string, keys ...string) string {
		for _, k := range keys {
			if i, ok := idx[k]; ok && i < len(row) {
				return strings.TrimSpace(row[i])
			}
		}
		return ""
	}
	n := 0
	for {
		row, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			continue
		}
		e := PasswordEntry{
			Name:     get(row, "name", "标题"),
			URL:      get(row, "url", "网址", "网站"),
			Username: get(row, "username", "用户名"),
			Password: get(row, "password", "密码"),
		}
		if e.Name == "" && e.URL == "" {
			continue
		}
		if _, err := s.Save(e); err != nil {
			return n, err
		}
		n++
	}
	core.GlobalBus.Publish("passwords.imported", map[string]interface{}{"count": n})
	return n, nil
}

// passwordStrength returns 0-4 (very weak → very strong).
func passwordStrength(p string) int {
	if p == "" {
		return 0
	}
	score := 0
	if len(p) >= 8 {
		score++
	}
	if len(p) >= 14 {
		score++
	}
	has := map[string]bool{}
	for _, c := range p {
		switch {
		case c >= 'a' && c <= 'z':
			has["lower"] = true
		case c >= 'A' && c <= 'Z':
			has["upper"] = true
		case c >= '0' && c <= '9':
			has["digit"] = true
		default:
			has["other"] = true
		}
	}
	kinds := len(has)
	if kinds >= 3 {
		score++
	}
	if kinds == 4 && len(p) >= 12 {
		score++
	}
	if score > 4 {
		score = 4
	}
	return score
}
