package recite

import "fmt"

type BizError struct {
	Code int
	Msg  string
}

func (e *BizError) Error() string {
	return e.Msg
}

func NewBizError(code int, format string, args ...any) error {
	return &BizError{Code: code, Msg: fmt.Sprintf(format, args...)}
}

func ParseError(err error) (int, string) {
	if err == nil {
		return 0, ""
	}
	if biz, ok := err.(*BizError); ok {
		return biz.Code, biz.Msg
	}
	return 1, err.Error()
}
