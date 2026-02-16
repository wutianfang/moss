package main

import (
	"database/sql"

	"github.com/labstack/echo/v4"
	"github.com/wutianfang/moss/app/handler/common"
	recitehandler "github.com/wutianfang/moss/app/handler/recite"
	todohandler "github.com/wutianfang/moss/app/handler/todo"
	"github.com/wutianfang/moss/app/service/recite"
	"github.com/wutianfang/moss/conf"
	"github.com/wutianfang/moss/infra/recite/fetcher"
	"github.com/wutianfang/moss/infra/recite/repository"
)

func registerRoutes(e *echo.Echo, cfg *conf.Config, db *sql.DB) {
	wordRepo := repository.NewWordRepository(db)
	unitRepo := repository.NewUnitRepository(db)
	unitWordRepo := repository.NewUnitWordRepository(db)
	wordFetcher := fetcher.NewIcibaFetcher(cfg.Storage.WordMP3Dir)
	reciteService := recite.NewService(wordRepo, unitRepo, unitWordRepo, wordFetcher)

	e.Static("/static", "static")
	e.Static("/word_mp3", cfg.Storage.WordMP3Dir)

	e.GET("/", common.IndexPage)
	e.GET("/healthz", common.Health)

	api := e.Group("/api")
	api.GET("/todo/placeholder", todohandler.Placeholder)

	reciteGroup := api.Group("/recite")
	reciteGroup.GET("/units", recitehandler.ListUnits(reciteService))
	reciteGroup.POST("/units", recitehandler.CreateUnit(reciteService))
	reciteGroup.PUT("/units/:unitId/name", recitehandler.RenameUnit(reciteService))
	reciteGroup.POST("/words/query", recitehandler.QueryWord(reciteService))
	reciteGroup.POST("/units/:unitId/words", recitehandler.AddUnitWord(reciteService))
	reciteGroup.GET("/units/:unitId/words", recitehandler.ListUnitWords(reciteService))
	reciteGroup.GET("/units/:unitId/dictation", recitehandler.GetDictation(reciteService))
}
