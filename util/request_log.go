package util

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)

const ResponseHeaderLogID = "X-Log-ID"

var requestLogEnabled bool

type requestMeta struct {
	LogID string
	Start time.Time
}

type requestMetaKey struct{}

func RequestLogIDMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			start := time.Now()
			logID := buildLogID(start)

			ctx := withRequestMeta(c.Request().Context(), requestMeta{
				LogID: logID,
				Start: start,
			})
			c.SetRequest(c.Request().WithContext(ctx))
			c.Response().Header().Set(ResponseHeaderLogID, logID)

			return next(c)
		}
	}
}

func InfofWithRequest(ctx context.Context, location string, format string, args ...any) {
	logfWithRequest(Infof, ctx, location, format, args...)
}

func ErrorfWithRequest(ctx context.Context, location string, format string, args ...any) {
	logfWithRequest(Errorf, ctx, location, format, args...)
}

func logfWithRequest(logFn func(string, ...any), ctx context.Context, location string, format string, args ...any) {
	if !requestLogEnabled {
		return
	}
	meta := getRequestMeta(ctx)
	logID := meta.LogID
	if logID == "" {
		logID = "-"
	}
	costMS := int64(0)
	if !meta.Start.IsZero() {
		costMS = time.Since(meta.Start).Milliseconds()
	}
	location = strings.TrimSpace(location)
	if location == "" {
		location = "-"
	}
	logFn("[logid=%s] [loc=%s] [cost_ms=%d] "+format, append([]any{logID, location, costMS}, args...)...)
}

func SetRequestLogEnabled(enabled bool) {
	requestLogEnabled = enabled
}

func withRequestMeta(ctx context.Context, meta requestMeta) context.Context {
	return context.WithValue(ctx, requestMetaKey{}, meta)
}

func getRequestMeta(ctx context.Context) requestMeta {
	if ctx == nil {
		return requestMeta{}
	}
	value := ctx.Value(requestMetaKey{})
	meta, ok := value.(requestMeta)
	if !ok {
		return requestMeta{}
	}
	return meta
}

func buildLogID(now time.Time) string {
	// format: yyyymmddhhmmss + 6 random digits
	return now.Format("20060102150405") + randomDigits(6)
}

func randomDigits(n int) string {
	if n <= 0 {
		return ""
	}
	limit := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(n)), nil)
	value, err := rand.Int(rand.Reader, limit)
	if err != nil {
		// fallback: still preserve length and randomness-ish
		return fmt.Sprintf("%0*d", n, time.Now().UnixNano()%limit.Int64())
	}
	return fmt.Sprintf("%0*d", n, value.Int64())
}
