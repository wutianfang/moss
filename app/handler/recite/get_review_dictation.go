package recite

import (
	"github.com/labstack/echo/v4"
	"github.com/wutianfang/moss/app/service/recite"
	"github.com/wutianfang/moss/util"
)

func GetReviewDictation(svc *recite.Service) echo.HandlerFunc {
	return func(c echo.Context) error {
		items, err := svc.GetReviewDictationWordsByDate(c.Request().Context(), c.QueryParam("date"))
		if err != nil {
			code, msg := recite.ParseError(err)
			return util.JSONError(c, code, msg)
		}
		return util.JSONSuccess(c, map[string]any{
			"words": items,
			"total": len(items),
		})
	}
}
