package recite

import (
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/wutianfang/moss/app/service/recite"
	"github.com/wutianfang/moss/util"
)

func SubmitQuizWord(svc *recite.Service) echo.HandlerFunc {
	type request struct {
		InputAnswer string `json:"input_answer" form:"input_answer"`
		Result      string `json:"result" form:"result"`
	}

	return func(c echo.Context) error {
		quizID, err := strconv.ParseInt(c.Param("quizId"), 10, 64)
		if err != nil {
			return util.JSONError(c, 1001, "quiz_id 非法")
		}
		seq, err := strconv.Atoi(c.Param("seq"))
		if err != nil {
			return util.JSONError(c, 1001, "seq 非法")
		}
		req := request{}
		if err := c.Bind(&req); err != nil {
			return util.JSONError(c, 1001, "请求参数错误")
		}
		if err := svc.SubmitQuizWord(c.Request().Context(), quizID, seq, req.InputAnswer, req.Result); err != nil {
			code, msg := recite.ParseError(err)
			return util.JSONError(c, code, msg)
		}
		return util.JSONSuccess(c, map[string]any{"ok": true})
	}
}
