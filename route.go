package main

import (
	"compress/gzip"
	"database/sql"

	"github.com/labstack/echo/v4"
	"github.com/wutianfang/moss/app/handler/common"
	recitehandler "github.com/wutianfang/moss/app/handler/recite"
	todohandler "github.com/wutianfang/moss/app/handler/todo"
	"github.com/wutianfang/moss/app/service/recite"
	"github.com/wutianfang/moss/conf"
	"github.com/wutianfang/moss/infra/recite/fetcher"
	"github.com/wutianfang/moss/infra/recite/repository"
	"github.com/wutianfang/moss/util"
)

func registerRoutes(e *echo.Echo, cfg *conf.Config, db *sql.DB) {
	wordRepo := repository.NewWordRepository(db)
	unitRepo := repository.NewUnitRepository(db)
	unitWordRepo := repository.NewUnitWordRepository(db)
	forgottenRepo := repository.NewForgottenWordRepository(db)
	wordFetcher := fetcher.NewIcibaFetcher(cfg.Storage.WordMP3Dir)
	reciteService := recite.NewService(
		wordRepo,
		unitRepo,
		unitWordRepo,
		forgottenRepo,
		wordFetcher,
		cfg.Recite.DefaultAccent,
		cfg.Recite.ReviewIntervalsDays,
	)

	e.Static("/static", "static")
	e.Static("/word_mp3", cfg.Storage.WordMP3Dir)

	e.GET("/", common.IndexPage)
	e.GET("/healthz", common.Health)

	api := e.Group("/api")
	api.Use(util.GzipResponseMiddleware(gzip.BestSpeed))
	api.GET("/todo/placeholder", todohandler.Placeholder)

	reciteGroup := api.Group("/recite")
	reciteGroup.GET("/config", recitehandler.GetClientConfig(reciteService))
	reciteGroup.GET("/units", recitehandler.ListUnits(reciteService))
	reciteGroup.POST("/units", recitehandler.CreateUnit(reciteService))
	reciteGroup.PUT("/units/:unitId/name", recitehandler.RenameUnit(reciteService))
	reciteGroup.DELETE("/units/:unitId", recitehandler.DeleteUnit(reciteService))
	reciteGroup.PUT("/units/order", recitehandler.ReorderUnits(reciteService))
	reciteGroup.POST("/words/query", recitehandler.QueryWord(reciteService))
	reciteGroup.POST("/units/:unitId/words", recitehandler.AddUnitWord(reciteService))
	reciteGroup.GET("/units/:unitId/words", recitehandler.ListUnitWords(reciteService))
	reciteGroup.GET("/units/:unitId/dictation", recitehandler.GetDictation(reciteService))
	reciteGroup.GET("/review/dates", recitehandler.ListReviewDates(reciteService))
	reciteGroup.GET("/review/words", recitehandler.ListReviewWords(reciteService))
	reciteGroup.GET("/review/dictation", recitehandler.GetReviewDictation(reciteService))
	reciteGroup.POST("/forgotten/words", recitehandler.AddForgottenWord(reciteService))
	reciteGroup.GET("/forgotten/words", recitehandler.ListForgottenWords(reciteService))
	reciteGroup.POST("/forgotten/words/remember", recitehandler.RememberForgottenWord(reciteService))
	reciteGroup.GET("/forgotten/dictation", recitehandler.GetForgottenDictation(reciteService))
}
