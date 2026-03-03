package recite

import (
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/wutianfang/moss/app/service/recite"
	"github.com/wutianfang/moss/util"
)

func ListNotesByWords(svc *recite.Service) echo.HandlerFunc {
	return func(c echo.Context) error {
		raw := strings.TrimSpace(c.QueryParam("word_ids"))
		if raw == "" {
			return util.JSONSuccess(c, map[string]any{"word_notes": map[string]any{}})
		}
		parts := strings.Split(raw, ",")
		wordIDs := make([]int64, 0, len(parts))
		for _, item := range parts {
			text := strings.TrimSpace(item)
			if text == "" {
				continue
			}
			id, err := strconv.ParseInt(text, 10, 64)
			if err != nil {
				return util.JSONError(c, 1001, "word_ids 非法")
			}
			wordIDs = append(wordIDs, id)
		}
		rows, err := svc.ListNotesByWordIDs(c.Request().Context(), wordIDs)
		if err != nil {
			code, msg := recite.ParseError(err)
			return util.JSONError(c, code, msg)
		}
		return util.JSONSuccess(c, map[string]any{"word_notes": rows})
	}
}
