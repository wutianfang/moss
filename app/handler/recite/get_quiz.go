package recite

import (
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/wutianfang/moss/app/service/recite"
	"github.com/wutianfang/moss/util"
)

func GetQuiz(svc *recite.Service) echo.HandlerFunc {
	return func(c echo.Context) error {
		quizID, err := strconv.ParseInt(c.Param("quizId"), 10, 64)
		if err != nil {
			return util.JSONError(c, 1001, "quiz_id 非法")
		}
		detail, err := svc.GetQuizDetail(c.Request().Context(), quizID)
		if err != nil {
			code, msg := recite.ParseError(err)
			return util.JSONError(c, code, msg)
		}
		return util.JSONSuccess(c, map[string]any{"quiz": detail})
	}
}
