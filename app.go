package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"personal-terminal/backend/bridge"
	"personal-terminal/backend/core"
	"personal-terminal/backend/db"
	"personal-terminal/backend/modules"
)

// App is the root struct passed to Wails. Anything bound here becomes
// callable from the frontend as window.go.main.App.<Method>.
type App struct {
	ctx               context.Context
	bus               *core.EventBus
	store             *db.Store
	config            *core.Config
	fascinatorService *modules.FascinatorService
	bridge            *bridge.Server
}

// NewApp takes the Fascinator service created in main.go so the instance
// bound to the frontend and the one managed by the app lifecycle are the
// same object — otherwise frontend Start() and app shutdown() would act
// on two different processes.
func NewApp(fascinatorSvc *modules.FascinatorService) *App {
	return &App{
		bus:               core.NewEventBus(),
		fascinatorService: fascinatorSvc,
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	cfg, err := core.LoadConfig()
	if err != nil {
		log.Printf("config load fallback to defaults: %v", err)
		cfg = core.DefaultConfig()
	}
	a.config = cfg

	store, err := db.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	a.store = store

	if err := store.Migrate(); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	core.GlobalStore = store
	core.GlobalBus = a.bus
	core.GlobalConfig = cfg

	// Configure the Fascinator launcher from the persisted config.
	// Paths are machine-specific, so they live in config.json (editable
	// in Settings), never hardcoded here.
	if a.config.FascinatorApp != "" {
		if err := a.fascinatorService.Configure(
			a.config.FascinatorPython,
			a.config.FascinatorApp,
			a.config.FascinatorPort,
		); err != nil {
			log.Printf("fascinator configure: %v", err)
		}
		if a.config.FascinatorConfig != "" {
			a.fascinatorService.SetConfigPath(a.config.FascinatorConfig)
		}
	} else {
		log.Println("fascinator not configured — set paths in Settings")
	}

	// Reverse bridge: let Fascinator (or any localhost tool) operate
	// Charon over a token-guarded HTTP API.
	if a.config.BridgeEnabled {
		token := bridge.EnsureToken(a.config)
		port := a.config.BridgePort
		if port <= 0 {
			port = 17734
		}
		a.bridge = bridge.New(port, token, func(name string, data ...interface{}) {
			if a.ctx != nil {
				runtime.EventsEmit(a.ctx, name, data...)
			}
		})
		if err := a.bridge.Start(); err != nil {
			log.Printf("bridge start failed: %v", err)
		}
	}

	log.Println("personal-terminal started")
}

func (a *App) shutdown(ctx context.Context) {
	if a.bridge != nil {
		a.bridge.Stop()
	}
	if a.store != nil {
		_ = a.store.Close()
	}
	// Safely stop the Fascinator subprocess on exit.
	if a.fascinatorService != nil {
		_ = a.fascinatorService.Stop()
	}
}

// BridgeInfo tells the Settings UI where the reverse API is listening.
func (a *App) BridgeInfo() map[string]interface{} {
	cfg := a.config
	if cfg == nil {
		cfg = core.GlobalConfig
	}
	enabled := cfg != nil && cfg.BridgeEnabled
	port := 17734
	token := ""
	if cfg != nil {
		if cfg.BridgePort > 0 {
			port = cfg.BridgePort
		}
		token = cfg.BridgeToken
	}
	return map[string]interface{}{
		"enabled": enabled,
		"port":    port,
		"url":     fmt.Sprintf("http://127.0.0.1:%d", port),
		"token":   token,
	}
}

// Greet is a minimal smoke-test binding the frontend
func (a *App) Greet(name string) string {
	return "hello " + name
}

func (a *App) Version() string {
	return "0.1.0"
}

// FascinatorSettings is the launcher configuration shown in Settings.
type FascinatorSettings struct {
	Python string `json:"python"`
	App    string `json:"app"`
	Config string `json:"config"`
	Port   int    `json:"port"`
}

// GetFascinatorSettings returns the persisted Fascinator launcher config.
func (a *App) GetFascinatorSettings() FascinatorSettings {
	cfg := a.config
	if cfg == nil {
		cfg = core.GlobalConfig
	}
	if cfg == nil {
		return FascinatorSettings{Port: 5000}
	}
	return FascinatorSettings{
		Python: cfg.FascinatorPython,
		App:    cfg.FascinatorApp,
		Config: cfg.FascinatorConfig,
		Port:   cfg.FascinatorPort,
	}
}

// SaveFascinatorSettings persists the launcher config and applies it to the
// live service. The new paths take effect on the next Fascinator start.
func (a *App) SaveFascinatorSettings(s FascinatorSettings) error {
	cfg := a.config
	if cfg == nil {
		cfg = core.GlobalConfig
	}
	if cfg == nil {
		return errors.New("config not loaded")
	}

	cfg.FascinatorPython = s.Python
	cfg.FascinatorApp = s.App
	cfg.FascinatorConfig = s.Config
	if s.Port > 0 {
		cfg.FascinatorPort = s.Port
	}
	if err := cfg.Save(); err != nil {
		return err
	}
	a.config = cfg

	if s.App != "" {
		if err := a.fascinatorService.Configure(s.Python, s.App, s.Port); err != nil {
			return err
		}
		a.fascinatorService.SetConfigPath(s.Config)
	}
	return nil
}

// ReadPluginFile 提供给前端，用来安全读取用户本地磁盘插件目录下的指定文件内容
// 前端可通过 window.go.main.App.ReadPluginFile(pluginId, filename) 异步跨界调用
func (a *App) ReadPluginFile(pluginID string, filename string) (string, error) {
	// 1. 动态获取当前 system 用户的 Home 目录（例如 C:\Users\89275）
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}

	// 2. 安全拼接完整的本地物理路径
	// 结果：C:\Users\89275\.personal-terminal\plugins\<pluginID>\<filename>
	pluginFilePath := filepath.Join(homeDir, ".personal-terminal", "plugins", pluginID, filename)

	// 3. 打开并读取该文件内容
	file, err := os.Open(pluginFilePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		return "", err
	}

	// 4. 返回纯文本内容给 React 前端处理
	return string(content), nil
}