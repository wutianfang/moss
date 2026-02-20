package recite

import (
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/wutianfang/moss/app/service/recite"
	"github.com/wutianfang/moss/util"
)

func DeleteUnit(svc *recite.Service) echo.HandlerFunc {
	return func(c echo.Context) error {
		unitID, err := strconv.ParseInt(c.Param("unitId"), 10, 64)
		if err != nil {
			return util.JSONError(c, 1001, "unit_id 非法")
		}
		if err := svc.DeleteUnit(c.Request().Context(), unitID); err != nil {
			code, msg := recite.ParseError(err)
			return util.JSONError(c, code, msg)
		}
		return util.JSONSuccess(c, map[string]any{"ok": true})
	}
}
