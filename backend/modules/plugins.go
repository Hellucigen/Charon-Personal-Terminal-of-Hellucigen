package modules

import (
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"

	"personal-terminal/backend/core"
)

type PluginsService struct{}

func NewPluginsService() *PluginsService { return &PluginsService{} }

// List enumerates installed plugins by scanning the plugins dir.
func (s *PluginsService) List() ([]core.PluginManifest, error) {
	cfg := core.GlobalConfig
	if cfg == nil {
		return nil, errors.New("config not initialized")
	}
	entries, err := os.ReadDir(cfg.PluginsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []core.PluginManifest{}, nil
		}
		return nil, err
	}
	out := []core.PluginManifest{}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		manifestPath := filepath.Join(cfg.PluginsDir, e.Name(), "plugin.json")
		raw, err := os.ReadFile(manifestPath)
		if err != nil {
			continue
		}
		var m core.PluginManifest
		if err := json.Unmarshal(raw, &m); err != nil {
			continue
		}
		if m.ID == "" {
			m.ID = e.Name()
		}
		out = append(out, m)
	}
	return out, nil
}

// LoadEntry returns the file contents of a plugin's entry script.
func (s *PluginsService) LoadEntry(pluginID, relativePath string) (string, error) {
	cfg := core.GlobalConfig
	if cfg == nil {
		return "", errors.New("config not initialized")
	}
	clean := filepath.Clean(relativePath)
	if filepath.IsAbs(clean) || filepath.HasPrefix(clean, "..") {
		return "", errors.New("invalid entry path")
	}
	full := filepath.Join(cfg.PluginsDir, pluginID, clean)
	rel, err := filepath.Rel(filepath.Join(cfg.PluginsDir, pluginID), full)
	if err != nil || filepath.HasPrefix(rel, "..") {
		return "", errors.New("escape attempt")
	}
	b, err := os.ReadFile(full)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func getEnabledList() []string {
	cfg := core.GlobalConfig
	if cfg == nil || cfg.EnabledPlugins == "" {
		return []string{}
	}
	var list []string
	json.Unmarshal([]byte(cfg.EnabledPlugins), &list)
	return list
}

func setEnabledList(list []string) error {
	cfg := core.GlobalConfig
	if cfg == nil {
		return errors.New("config not initialized")
	}
	data, _ := json.Marshal(list)
	cfg.EnabledPlugins = string(data)
	return cfg.Save()
}

// Enable toggles a plugin's enabled state.
func (s *PluginsService) Enable(pluginID string, enabled bool) error {
	list := getEnabledList()
	newList := []string{}
	found := false

	for _, id := range list {
		if id == pluginID {
			found = true
			if enabled {
				newList = append(newList, id)
			}
		} else {
			newList = append(newList, id)
		}
	}

	if enabled && !found {
		newList = append(newList, pluginID)
	}

	return setEnabledList(newList)
}

// IsEnabled checks if a plugin is currently enabled.
func (s *PluginsService) IsEnabled(pluginID string) bool {
	for _, id := range getEnabledList() {
		if id == pluginID {
			return true
		}
	}
	return false
}

// OpenFolder opens the plugin directory in the system file manager.
func (s *PluginsService) OpenFolder(pluginID string) error {
	cfg := core.GlobalConfig
	if cfg == nil {
		return errors.New("config not initialized")
	}

	folder := filepath.Join(cfg.PluginsDir, pluginID)
	if _, err := os.Stat(folder); err != nil {
		return err
	}

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("explorer", folder)
	case "darwin":
		cmd = exec.Command("open", folder)
	default:
		cmd = exec.Command("xdg-open", folder)
	}
	return cmd.Start()
}