package recite

import (
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/wutianfang/moss/app/service/recite"
	"github.com/wutianfang/moss/util"
)

func AddUnitWord(svc *recite.Service) echo.HandlerFunc {
	type request struct {
		Word string `json:"word" form:"word"`
	}

	return func(c echo.Context) error {
		unitID, err := strconv.ParseInt(c.Param("unitId"), 10, 64)
		if err != nil {
			return util.JSONError(c, 1001, "unit_id 非法")
		}
		req := request{}
		if err := c.Bind(&req); err != nil {
			return util.JSONError(c, 1001, "请求参数错误")
		}
		if err := svc.AddWordToUnit(c.Request().Context(), unitID, req.Word); err != nil {
			code, msg := recite.ParseError(err)
			return util.JSONError(c, code, msg)
		}
		return util.JSONSuccess(c, map[string]any{"ok": true})
	}
}
