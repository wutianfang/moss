package todo

type Placeholder struct {
	Message string `json:"message"`
}

func GetPlaceholder() Placeholder {
	return Placeholder{Message: "todo list 功能待开发"}
}
