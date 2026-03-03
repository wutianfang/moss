package recite

import (
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/wutianfang/moss/app/service/recite"
	"github.com/wutianfang/moss/util"
)

func UpdateNote(svc *recite.Service) echo.HandlerFunc {
	type request struct {
		NoteType string  `json:"note_type" form:"note_type"`
		Content  string  `json:"content" form:"content"`
		WordIDs  []int64 `json:"word_ids" form:"word_ids"`
	}
	return func(c echo.Context) error {
		noteID, err := strconv.ParseInt(c.Param("noteId"), 10, 64)
		if err != nil {
			return util.JSONError(c, 1001, "note_id 非法")
		}
		req := request{}
		if err := c.Bind(&req); err != nil {
			return util.JSONError(c, 1001, "请求参数错误")
		}
		detail, err := svc.UpdateNote(c.Request().Context(), noteID, req.NoteType, req.Content, req.WordIDs)
		if err != nil {
			code, msg := recite.ParseError(err)
			return util.JSONError(c, code, msg)
		}
		return util.JSONSuccess(c, map[string]any{"note": detail})
	}
}
