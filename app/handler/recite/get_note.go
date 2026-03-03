package recite

import (
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/wutianfang/moss/app/service/recite"
	"github.com/wutianfang/moss/util"
)

func GetNote(svc *recite.Service) echo.HandlerFunc {
	return func(c echo.Context) error {
		noteID, err := strconv.ParseInt(c.Param("noteId"), 10, 64)
		if err != nil {
			return util.JSONError(c, 1001, "note_id 非法")
		}
		detail, err := svc.GetNoteDetail(c.Request().Context(), noteID)
		if err != nil {
			code, msg := recite.ParseError(err)
			return util.JSONError(c, code, msg)
		}
		return util.JSONSuccess(c, map[string]any{"note": detail})
	}
}
