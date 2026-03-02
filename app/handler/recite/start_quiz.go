package recite

import (
	"github.com/labstack/echo/v4"
	"github.com/wutianfang/moss/app/service/recite"
	"github.com/wutianfang/moss/util"
)

func StartQuiz(svc *recite.Service) echo.HandlerFunc {
	return func(c echo.Context) error {
		req := recite.StartQuizRequest{}
		if err := c.Bind(&req); err != nil {
			return util.JSONError(c, 1001, "请求参数错误")
		}
		detail, err := svc.StartQuiz(c.Request().Context(), req)
		if err != nil {
			code, msg := recite.ParseError(err)
			return util.JSONError(c, code, msg)
		}
		return util.JSONSuccess(c, map[string]any{"quiz": detail})
	}
}
