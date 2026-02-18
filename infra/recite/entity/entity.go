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
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	SortOrder int64     `json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type UnitWordRelation struct {
	ID        int64     `json:"id"`
	UnitID    int64     `json:"unit_id"`
	WordID    int64     `json:"word_id"`
	CreatedAt time.Time `json:"created_at"`
}
