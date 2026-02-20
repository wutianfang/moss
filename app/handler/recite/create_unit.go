package recite

import (
	"github.com/labstack/echo/v4"
	"github.com/wutianfang/moss/app/service/recite"
	"github.com/wutianfang/moss/util"
)

func CreateUnit(svc *recite.Service) echo.HandlerFunc {
	type request struct {
		Name       string `json:"name" form:"name"`
		ReciteDate string `json:"recite_date" form:"recite_date"`
	}

	return func(c echo.Context) error {
		req := request{}
		if err := c.Bind(&req); err != nil {
			return util.JSONError(c, 1001, "请求参数错误")
		}
		unit, err := svc.CreateUnit(c.Request().Context(), req.Name, req.ReciteDate)
		if err != nil {
			code, msg := recite.ParseError(err)
			return util.JSONError(c, code, msg)
		}
		return util.JSONSuccess(c, map[string]any{"unit": unit})
	}
}
