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

	// ✨ 新增这两个关键字段，用来持久化存储 Fascinator 的本地物理路径
	FascinatorPython string `json:"fascinator_python"`
	FascinatorApp    string `json:"fascinator_app"`

	FascinatorURL  string `json:"fascinator_url"`
	AnthropicKey   string `json:"anthropic_key"`
	OpenAIKey      string `json:"openai_key"`

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

		// ✨ 默认帮你在 Windows 下对齐到项目真实的虚拟环境和 app.py 入口
		FascinatorPython: `E:\Fascinator\.venv\Scripts\python.exe`,
		FascinatorApp:    `E:\Fascinator\app.py`,

		FascinatorURL: "http://127.0.0.1:5000",
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