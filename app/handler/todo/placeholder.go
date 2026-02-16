package todo

import (
	"github.com/labstack/echo/v4"
	todoservice "github.com/wutianfang/moss/app/service/todo"
	"github.com/wutianfang/moss/util"
)

func Placeholder(c echo.Context) error {
	return util.JSONSuccess(c, todoservice.GetPlaceholder())
}
