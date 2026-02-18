package recite

import (
	"github.com/labstack/echo/v4"
	"github.com/wutianfang/moss/app/service/recite"
	"github.com/wutianfang/moss/util"
)

func ReorderUnits(svc *recite.Service) echo.HandlerFunc {
	type request struct {
		UnitIDs []int64 `json:"unit_ids" form:"unit_ids"`
	}

	return func(c echo.Context) error {
		req := request{}
		if err := c.Bind(&req); err != nil {
			return util.JSONError(c, 1001, "请求参数错误")
		}
		if err := svc.ReorderUnits(c.Request().Context(), req.UnitIDs); err != nil {
			code, msg := recite.ParseError(err)
			return util.JSONError(c, code, msg)
		}
		return util.JSONSuccess(c, map[string]any{"ok": true})
	}
}
