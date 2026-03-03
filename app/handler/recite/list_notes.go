package recite

import (
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/wutianfang/moss/app/service/recite"
	"github.com/wutianfang/moss/util"
)

func ListNotes(svc *recite.Service) echo.HandlerFunc {
	return func(c echo.Context) error {
		page := 1
		if raw := strings.TrimSpace(c.QueryParam("page")); raw != "" {
			parsed, err := strconv.Atoi(raw)
			if err != nil {
				return util.JSONError(c, 1001, "page 非法")
			}
			page = parsed
		}
		pageSize := 20
		if raw := strings.TrimSpace(c.QueryParam("page_size")); raw != "" {
			parsed, err := strconv.Atoi(raw)
			if err != nil {
				return util.JSONError(c, 1001, "page_size 非法")
			}
			pageSize = parsed
		}
		items, total, err := svc.ListNotes(c.Request().Context(), page, pageSize)
		if err != nil {
			code, msg := recite.ParseError(err)
			return util.JSONError(c, code, msg)
		}
		return util.JSONSuccess(c, map[string]any{
			"items":     items,
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		})
	}
}
