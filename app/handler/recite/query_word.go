package recite

import (
	"github.com/labstack/echo/v4"
	"github.com/wutianfang/moss/app/service/recite"
	"github.com/wutianfang/moss/util"
)

func QueryWord(svc *recite.Service) echo.HandlerFunc {
	type request struct {
		Word string `json:"word" form:"word" query:"word"`
	}

	return func(c echo.Context) error {
		req := request{}
		if err := c.Bind(&req); err != nil {
			return util.JSONError(c, 1001, "请求参数错误")
		}
		wordInfo, err := svc.QueryWord(c.Request().Context(), req.Word)
		if err != nil {
			code, msg := recite.ParseError(err)
			return util.JSONError(c, code, msg)
		}
		return util.JSONSuccess(c, map[string]any{"word": wordInfo})
	}
}
