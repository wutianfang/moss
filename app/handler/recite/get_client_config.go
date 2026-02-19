package recite

import (
	"github.com/labstack/echo/v4"
	"github.com/wutianfang/moss/app/service/recite"
	"github.com/wutianfang/moss/util"
)

func GetClientConfig(svc *recite.Service) echo.HandlerFunc {
	return func(c echo.Context) error {
		cfg := svc.GetClientConfig()
		return util.JSONSuccess(c, map[string]any{"config": cfg})
	}
}
