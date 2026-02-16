package main

import (
	"log"

	"github.com/labstack/echo/v4"
	"github.com/wutianfang/moss/conf"
	"github.com/wutianfang/moss/infra/db"
	"github.com/wutianfang/moss/util"
)

func main() {
	cfg, err := conf.Load("conf/config.yaml")
	if err != nil {
		log.Fatalf("load config failed: %v", err)
	}

	if err := util.InitLogger(cfg.Log.Dir); err != nil {
		log.Fatalf("init logger failed: %v", err)
	}

	database, err := db.InitMySQL(&cfg.MySQL)
	if err != nil {
		util.Fatalf("init mysql failed: %v", err)
	}
	defer database.Close()

	if err := db.AutoMigrate(database); err != nil {
		util.Fatalf("auto migrate failed: %v", err)
	}

	e := echo.New()
	registerRoutes(e, cfg, database)

	util.Infof("server starting at %s", cfg.Server.Addr)
	if err := e.Start(cfg.Server.Addr); err != nil {
		util.Fatalf("echo start failed: %v", err)
	}
}
