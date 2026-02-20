package recite

import (
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/wutianfang/moss/app/service/recite"
	"github.com/wutianfang/moss/util"
)

func ListReviewDates(svc *recite.Service) echo.HandlerFunc {
	return func(c echo.Context) error {
		recentDays := 7
		if raw := c.QueryParam("recent_days"); raw != "" {
			v, err := strconv.Atoi(raw)
			if err != nil {
				return util.JSONError(c, 1001, "recent_days 非法")
			}
			recentDays = v
		}
		dates := svc.ListReviewDateOptions(recentDays)
		return util.JSONSuccess(c, map[string]any{"dates": dates})
	}
}
