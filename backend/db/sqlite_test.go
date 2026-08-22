package db

import (
	"path/filepath"
	"testing"
)

// TestMigrateFreshDB applies every migration to an empty database —
// a cheap guard that new migration SQL is valid before it ships.
func TestMigrateFreshDB(t *testing.T) {
	path := filepath.Join(t.TempDir(), "test.db")
	store, err := Open(path)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer store.Close()
	if err := store.Migrate(); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	// Migrate again — everything must be a no-op.
	if err := store.Migrate(); err != nil {
		t.Fatalf("re-migrate: %v", err)
	}
}
