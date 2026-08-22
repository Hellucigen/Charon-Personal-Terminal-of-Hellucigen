package core

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// Config holds the user-tunable settings for the terminal.
// Loaded from ~/.personal-terminal/config.json or via defaults.
type Config struct {
	WorkspaceDir   string `json:"workspace_dir"`
	DBPath         string `json:"db_path"`
	MediaDir       string `json:"media_dir"`
	PluginsDir     string `json:"plugins_dir"`
	EnabledPlugins string `json:"enabled_plugins"` // JSON array string: ["id1","id2"]

	// Fascinator launcher paths — configured in Settings, persisted here.
	// Left empty by default; the UI shows a hint until the user fills them in.
	FascinatorPython string `json:"fascinator_python"`
	FascinatorApp    string `json:"fascinator_app"`
	FascinatorConfig string `json:"fascinator_config"` // path to Fascinator's own config.json (optional)
	FascinatorPort   int    `json:"fascinator_port"`

	FascinatorURL  string `json:"fascinator_url"`
	AnthropicKey   string `json:"anthropic_key"`
	OpenAIKey      string `json:"openai_key"`

	// Reverse bridge — the localhost API Fascinator uses to operate
	// Charon (create notes / todos / fleeting, notify, events).
	BridgeEnabled bool   `json:"bridge_enabled"`
	BridgePort    int    `json:"bridge_port"`
	BridgeToken   string `json:"bridge_token"`

	AccentColor string `json:"accent_color"`
	Locale      string `json:"locale"`
}

var (
	GlobalConfig *Config
	GlobalStore  any // assigned at startup; typed by importers
	GlobalBus    *EventBus
)

func DefaultConfig() *Config {
	home, _ := os.UserHomeDir()
	root := filepath.Join(home, ".personal-terminal")
	return &Config{
		WorkspaceDir:  root,
		DBPath:        filepath.Join(root, "terminal.db"),
		MediaDir:      filepath.Join(root, "media"),
		PluginsDir:    filepath.Join(root, "plugins"),

		// Fascinator paths are machine-specific — set them in Settings,
		// they land in config.json instead of being baked into the binary.
		FascinatorPython: "",
		FascinatorApp:    "",
		FascinatorConfig: "",
		FascinatorPort:   5000,

		FascinatorURL: "http://127.0.0.1:5000",

		BridgeEnabled: true,
		BridgePort:    17734,
		AccentColor:   "cyan",
		Locale:        "zh-CN",
	}
}

func LoadConfig() (*Config, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	root := filepath.Join(home, ".personal-terminal")
	if err := os.MkdirAll(root, 0o755); err != nil {
		return nil, err
	}
	path := filepath.Join(root, "config.json")

	cfg := DefaultConfig()
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			// Persist defaults on first launch.
			_ = saveConfig(path, cfg)
			return cfg, nil
		}
		return nil, err
	}
	if err := json.Unmarshal(data, cfg); err != nil {
		return nil, err
	}
	// Ensure media + plugins dirs exist.
	_ = os.MkdirAll(cfg.MediaDir, 0o755)
	_ = os.MkdirAll(cfg.PluginsDir, 0o755)
	return cfg, nil
}

func saveConfig(path string, c *Config) error {
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

func (c *Config) Save() error {
	home, _ := os.UserHomeDir()
	return saveConfig(filepath.Join(home, ".personal-terminal", "config.json"), c)
}