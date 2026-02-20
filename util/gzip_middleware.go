package util

import (
	"compress/gzip"
	"io"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
)

type gzipResponseWriter struct {
	io.Writer
	http.ResponseWriter
}

func (w *gzipResponseWriter) Write(b []byte) (int, error) {
	return w.Writer.Write(b)
}

func (w *gzipResponseWriter) Flush() {
	if gz, ok := w.Writer.(*gzip.Writer); ok {
		_ = gz.Flush()
	}
	if flusher, ok := w.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}

func GzipResponseMiddleware(level int) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if !strings.Contains(c.Request().Header.Get(echo.HeaderAcceptEncoding), "gzip") {
				return next(c)
			}

			resp := c.Response()
			origWriter := resp.Writer
			gzWriter, err := gzip.NewWriterLevel(origWriter, level)
			if err != nil {
				return next(c)
			}
			defer gzWriter.Close()

			resp.Header().Set(echo.HeaderContentEncoding, "gzip")
			resp.Header().Add(echo.HeaderVary, echo.HeaderAcceptEncoding)
			resp.Header().Del(echo.HeaderContentLength)
			resp.Writer = &gzipResponseWriter{
				Writer:         gzWriter,
				ResponseWriter: origWriter,
			}
			defer func() {
				resp.Writer = origWriter
			}()

			return next(c)
		}
	}
}
