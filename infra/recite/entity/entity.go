package entity

import "time"

type WordPart struct {
	Part  string   `json:"part"`
	Means []string `json:"means"`
}

type WordSentenceGroup struct {
	Tag       string         `json:"tag"`
	Word      string         `json:"word"`
	Meaning   string         `json:"meaning"`
	Sentences []WordSentence `json:"sentences"`
}

type WordSentence struct {
	ID      int    `json:"id"`
	Type    int    `json:"type"`
	CN      string `json:"cn"`
	EN      string `json:"en"`
	From    string `json:"from"`
	TTSURL  string `json:"ttsUrl"`
	TTSSize int    `json:"ttsSize"`
	LikeNum int    `json:"likeNum"`
}

type Word struct {
	ID             int64               `json:"id"`
	Word           string              `json:"word"`
	PhEn           string              `json:"ph_en"`
	PhAm           string              `json:"ph_am"`
	MeanTag        string              `json:"mean_tag"`
	Parts          []WordPart          `json:"parts"`
	SentenceGroups []WordSentenceGroup `json:"sentence_groups"`
	CreatedAt      time.Time           `json:"created_at"`
	UpdatedAt      time.Time           `json:"updated_at"`
}

type ReciteUnit struct {
	ID         int64      `json:"id"`
	Name       string     `json:"name"`
	ReciteDate *time.Time `json:"recite_date"`
	SortOrder  int64      `json:"sort_order"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

type UnitWordRelation struct {
	ID        int64     `json:"id"`
	UnitID    int64     `json:"unit_id"`
	WordID    int64     `json:"word_id"`
	CreatedAt time.Time `json:"created_at"`
}

type Quiz struct {
	ID               int64      `json:"id"`
	QuizType         string     `json:"quiz_type"`
	Title            string     `json:"title"`
	Status           string     `json:"status"`
	SourceKind       string     `json:"source_kind"`
	SourceUnitID     int64      `json:"source_unit_id"`
	SourceReviewDate *time.Time `json:"source_review_date"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type QuizWord struct {
	ID          int64     `json:"id"`
	QuizID      int64     `json:"quiz_id"`
	WordID      int64     `json:"word_id"`
	OrderNo     int       `json:"order_no"`
	Status      string    `json:"status"`
	InputAnswer string    `json:"input_answer"`
	Result      string    `json:"result"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
