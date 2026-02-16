package util

import "github.com/labstack/echo/v4"

type APIResponse struct {
	Errno int    `json:"errno"`
	Error string `json:"error,omitempty"`
	Data  any    `json:"data,omitempty"`
}

func JSONSuccess(c echo.Context, data any) error {
	return c.JSON(200, APIResponse{Data: data})
}

func JSONError(c echo.Context, errno int, msg string) error {
	return c.JSON(200, APIResponse{Errno: errno, Error: msg})
}
