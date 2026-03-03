package recite

import (
	"github.com/labstack/echo/v4"
	"github.com/wutianfang/moss/app/service/recite"
	"github.com/wutianfang/moss/util"
)

func CreateNote(svc *recite.Service) echo.HandlerFunc {
	type request struct {
		NoteType string  `json:"note_type" form:"note_type"`
		Content  string  `json:"content" form:"content"`
		WordIDs  []int64 `json:"word_ids" form:"word_ids"`
	}
	return func(c echo.Context) error {
		req := request{}
		if err := c.Bind(&req); err != nil {
			return util.JSONError(c, 1001, "请求参数错误")
		}
		detail, err := svc.CreateNote(c.Request().Context(), req.NoteType, req.Content, req.WordIDs)
		if err != nil {
			code, msg := recite.ParseError(err)
			return util.JSONError(c, code, msg)
		}
		return util.JSONSuccess(c, map[string]any{"note": detail})
	}
}
