package common

import (
	"net/http"

	"github.com/labstack/echo/v4"
	commonservice "github.com/wutianfang/moss/app/service/common"
)

func IndexPage(c echo.Context) error {
	return c.File(commonservice.IndexFile())
}

func Health(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}
