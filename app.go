package main

import (
	"context"
	"io"
	"log"
	"os"
	"path/filepath"

	"personal-terminal/backend/core"
	"personal-terminal/backend/db"
	"personal-terminal/backend/modules" // ✨ 引入你编写的 fascinator 服务包
)

// App is the root struct passed to Wails. Anything bound here becomes
// callable from the frontend as window.go.main.App.<Method>.
type App struct {
	ctx               context.Context
	bus               *core.EventBus
	store             *db.Store
	config            *core.Config
	fascinatorService *modules.FascinatorService // ✨ 让 App 纳管 Fascinator 服务
}

func NewApp() *App {
	return &App{
		bus:               core.NewEventBus(),
		fascinatorService: modules.NewFascinatorService(), // ✨ 在这里完成实例化
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

	// =================================================================
	// ✨【核心修复逻辑】：在系统启动时，强行把路径注入给 Fascinator 服务实例！
	// =================================================================
	pythonPath := `E:\Fascinator\.venv\Scripts\python.exe` // 对应你真实的虚拟环境
	appPath    := `E:\Fascinator\app.py`                    // 对应你的 python 入口
	port       := 5000

	log.Println("正在强行配置 Fascinator 运行路径参数...")
	if err := a.fascinatorService.Configure(pythonPath, appPath, port); err != nil {
		log.Printf("❌ Fascinator 初始化路径配置失败: %v", err)
	}

	// 顺便把配置文件路径也强行绑定
	a.fascinatorService.SetConfigPath(`E:\Fascinator\config.json`)
	// =================================================================

	log.Println("personal-terminal started")
}

func (a *App) shutdown(ctx context.Context) {
	if a.store != nil {
		_ = a.store.Close()
	}
	// ✨ 在应用退出时安全关闭后台 Python 进程
	if a.fascinatorService != nil {
		_ = a.fascinatorService.Stop()
	}
}

// Greet is a minimal smoke-test binding the frontend
func (a *App) Greet(name string) string {
	return "hello " + name
}

func (a *App) Version() string {
	return "0.1.0"
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