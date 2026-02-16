module github.com/wutianfang/moss

go 1.19

require (
	github.com/go-sql-driver/mysql v1.7.1
	github.com/labstack/echo/v4 v4.7.2
	gopkg.in/yaml.v3 v3.0.1
)

require (
	github.com/labstack/gommon v0.4.2 // indirect
	github.com/mattn/go-colorable v0.1.14 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/valyala/bytebufferpool v1.0.0 // indirect
	github.com/valyala/fasttemplate v1.2.2 // indirect
	golang.org/x/crypto v0.38.0 // indirect
	golang.org/x/net v0.40.0 // indirect
	golang.org/x/sys v0.33.0 // indirect
	golang.org/x/text v0.25.0 // indirect
)

replace (
	golang.org/x/crypto => golang.org/x/crypto v0.26.0
	golang.org/x/net => golang.org/x/net v0.30.0
	golang.org/x/sys => golang.org/x/sys v0.30.0
	golang.org/x/text => golang.org/x/text v0.20.0
	golang.org/x/time => golang.org/x/time v0.5.0
)
