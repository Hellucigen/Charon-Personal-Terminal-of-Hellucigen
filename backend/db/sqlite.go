package db

import (
	"database/sql"
	"fmt"
	"path/filepath"

	_ "modernc.org/sqlite"
)

// Store wraps the SQLite handle used by every backend module.
// It exposes Migrate() to create or upgrade the schema, and the *sql.DB
// is exported for module-level queries.
type Store struct {
	DB *sql.DB
}

func Open(path string) (*Store, error) {
	if err := ensureDir(filepath.Dir(path)); err != nil {
		return nil, err
	}
	dsn := fmt.Sprintf("file:%s?_journal=WAL&_fk=1&cache=shared", path)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		return nil, err
	}
	return &Store{DB: db}, nil
}

func (s *Store) Close() error { return s.DB.Close() }

// Migrate applies all pending schema migrations in a single transaction.
// Add new entries to the migrations slice; ordering is preserved.
func (s *Store) Migrate() error {
	tx, err := s.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`CREATE TABLE IF NOT EXISTS schema_meta (
		key TEXT PRIMARY KEY, value TEXT
	)`); err != nil {
		return err
	}

	for i, m := range migrations {
		var applied int
		_ = tx.QueryRow(`SELECT 1 FROM schema_meta WHERE key=?`, fmt.Sprintf("m%d", i)).Scan(&applied)
		if applied == 1 {
			continue
		}
		if _, err := tx.Exec(m); err != nil {
			return fmt.Errorf("migration %d: %w", i, err)
		}
		if _, err := tx.Exec(`INSERT OR REPLACE INTO schema_meta(key,value) VALUES(?,?)`,
			fmt.Sprintf("m%d", i), "1"); err != nil {
			return err
		}
	}
	return tx.Commit()
}

var migrations = []string{
	// 0 — notes
	`CREATE TABLE IF NOT EXISTS notes (
		id          TEXT PRIMARY KEY,
		title       TEXT NOT NULL,
		template    TEXT NOT NULL DEFAULT 'blank',
		body        TEXT NOT NULL DEFAULT '',
		tags        TEXT NOT NULL DEFAULT '[]',
		parent_id   TEXT,
		created_at  INTEGER NOT NULL,
		updated_at  INTEGER NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_notes_parent ON notes(parent_id);
	CREATE INDEX IF NOT EXISTS idx_notes_template ON notes(template);
	CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
		id, title, body, tags, content='notes', content_rowid='rowid'
	);`,
	// 1 — todos
	`CREATE TABLE IF NOT EXISTS todos (
		id          TEXT PRIMARY KEY,
		title       TEXT NOT NULL,
		list        TEXT NOT NULL DEFAULT 'inbox',
		due_at      INTEGER,
		reminder_at INTEGER,
		repeat      TEXT,
		done        INTEGER NOT NULL DEFAULT 0,
		important   INTEGER NOT NULL DEFAULT 0,
		tags        TEXT NOT NULL DEFAULT '[]',
		notes       TEXT NOT NULL DEFAULT '',
		parent_id   TEXT,
		created_at  INTEGER NOT NULL,
		updated_at  INTEGER NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_todos_due ON todos(due_at);
	CREATE INDEX IF NOT EXISTS idx_todos_list ON todos(list);`,
	// 2 — fleeting notes
	`CREATE TABLE IF NOT EXISTS fleeting (
		id         TEXT PRIMARY KEY,
		body       TEXT NOT NULL,
		tags       TEXT NOT NULL DEFAULT '[]',
		media_path TEXT,
		promoted_to TEXT,
		created_at INTEGER NOT NULL
	);`,
	// 3 — shortcuts
	`CREATE TABLE IF NOT EXISTS shortcuts (
		id         TEXT PRIMARY KEY,
		label      TEXT NOT NULL,
		target     TEXT NOT NULL,   -- file://, http://, app://
		group_id   TEXT,
		icon       TEXT,
		pinned     INTEGER NOT NULL DEFAULT 0,
		open_count INTEGER NOT NULL DEFAULT 0,
		last_open  INTEGER,
		created_at INTEGER NOT NULL
	);`,
	// 4 — bookmarks
	`CREATE TABLE IF NOT EXISTS bookmarks (
		id         TEXT PRIMARY KEY,
		title      TEXT NOT NULL,
		url        TEXT NOT NULL,
		folder     TEXT NOT NULL DEFAULT '',
		tags       TEXT NOT NULL DEFAULT '[]',
		snapshot   TEXT,
		dead       INTEGER NOT NULL DEFAULT 0,
		last_check INTEGER,
		created_at INTEGER NOT NULL
	);`,
	// 5 — passwords (cipher-blob)
	`CREATE TABLE IF NOT EXISTS passwords (
		id         TEXT PRIMARY KEY,
		name       TEXT NOT NULL,
		url        TEXT,
		username   TEXT,
		cipher     BLOB NOT NULL,   -- AES-256-GCM payload (password + notes)
		nonce      BLOB NOT NULL,
		strength   INTEGER NOT NULL DEFAULT 0,
		duplicate  INTEGER NOT NULL DEFAULT 0,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL
	);`,
	// 6 — finance
	`CREATE TABLE IF NOT EXISTS transactions (
		id         TEXT PRIMARY KEY,
		amount     REAL NOT NULL,    -- positive=income, negative=expense
		currency   TEXT NOT NULL DEFAULT 'CNY',
		category   TEXT NOT NULL DEFAULT 'misc',
		account    TEXT NOT NULL DEFAULT 'default',
		note       TEXT NOT NULL DEFAULT '',
		occurred_at INTEGER NOT NULL,
		source     TEXT NOT NULL DEFAULT 'manual'  -- manual | alipay | wechat
	);`,
	// 7 — habits / health
	`CREATE TABLE IF NOT EXISTS habit_logs (
		id         TEXT PRIMARY KEY,
		habit      TEXT NOT NULL,
		value      REAL NOT NULL,
		unit       TEXT,
		logged_at  INTEGER NOT NULL,
		note       TEXT NOT NULL DEFAULT ''
	);`,
	// 8 — time tracking
	`CREATE TABLE IF NOT EXISTS pomodoros (
		id         TEXT PRIMARY KEY,
		task       TEXT NOT NULL DEFAULT '',
		duration_s INTEGER NOT NULL,
		started_at INTEGER NOT NULL,
		ended_at   INTEGER NOT NULL,
		kind       TEXT NOT NULL DEFAULT 'focus'  -- focus | break
	);
	CREATE TABLE IF NOT EXISTS app_usage (
		id         TEXT PRIMARY KEY,
		app_name   TEXT NOT NULL,
		title      TEXT,
		seconds    INTEGER NOT NULL,
		day        TEXT NOT NULL    -- YYYY-MM-DD
	);
	CREATE INDEX IF NOT EXISTS idx_app_usage_day ON app_usage(day);`,
	// 9 — gamification + dashboard
	`CREATE TABLE IF NOT EXISTS xp_log (
		id         TEXT PRIMARY KEY,
		amount     INTEGER NOT NULL,
		source     TEXT NOT NULL,
		stat       TEXT NOT NULL,   -- body|mind|create|social|wealth|will
		earned_at  INTEGER NOT NULL
	);
	CREATE TABLE IF NOT EXISTS achievements (
		id         TEXT PRIMARY KEY,
		title      TEXT NOT NULL,
		description TEXT,
		unlocked   INTEGER NOT NULL DEFAULT 0,
		unlocked_at INTEGER
	);`,
}
