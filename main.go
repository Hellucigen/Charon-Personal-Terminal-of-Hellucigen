package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"

	"personal-terminal/backend/modules"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Bindable module services. Each gets surfaced to the frontend
	// at window.go.<package>.<Method> via Wails' code generation.
	// fascinatorSvc is created once and shared with App so the bound
	// methods and the app lifecycle manage the same process.
	fascinatorSvc := modules.NewFascinatorService()
	notesSvc := modules.NewNotesService()
	todoSvc := modules.NewTodoService()
	fleetingSvc := modules.NewFleetingService()
	shortcutsSvc := modules.NewShortcutsService()
	bookmarksSvc := modules.NewBookmarksService()
	pluginsSvc := modules.NewPluginsService()
	passwordsSvc := modules.NewPasswordService()
	detectiveSvc := modules.NewDetectiveService()
	travelSvc := modules.NewTravelService()
	instituteSvc := modules.NewInstituteService()
	learningSvc := modules.NewLearningService()
	musicSvc := modules.NewMusicService()
	financeSvc := modules.NewFinanceService()
	healthSvc := modules.NewHealthService()
	creativeSvc := modules.NewCreativeService()
	netSvc := modules.NewNetService()
	timeSvc := modules.NewTimeService()
	rpgSvc := modules.NewRPGService()
	dataSvc := modules.NewDataService()
	diarySvc := modules.NewDiaryService()

	app := NewApp(fascinatorSvc)

	err := wails.Run(&options.App{
		Title:                    "Personal Terminal",
		Width:                    1440,
		Height:                   900,
		MinWidth:                 1100,
		MinHeight:                700,
		Frameless:                false,
		BackgroundColour:         &options.RGBA{R: 244, G: 244, B: 244, A: 255},
		AssetServer:              &assetserver.Options{Assets: assets},
		OnStartup:                app.startup,
		OnShutdown:               app.shutdown,
		EnableDefaultContextMenu: false,
		Bind: []interface{}{
			app,
			fascinatorSvc,
			notesSvc,
			todoSvc,
			fleetingSvc,
			shortcutsSvc,
			bookmarksSvc,
			pluginsSvc,
			passwordsSvc,
			detectiveSvc,
			travelSvc,
			instituteSvc,
			learningSvc,
			musicSvc,
			financeSvc,
			healthSvc,
			creativeSvc,
			netSvc,
			timeSvc,
			rpgSvc,
			dataSvc,
			diarySvc,
		},
		Windows: &windows.Options{
			WebviewIsTransparent:              true,
			WindowIsTranslucent:               true,
			BackdropType:                      windows.Mica,
			DisableFramelessWindowDecorations: false,
		},
	})

	if err != nil {
		log.Fatal(err)
	}
}
