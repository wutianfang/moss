package recite

type WordPart struct {
	Part  string   `json:"part"`
	Means []string `json:"means"`
}

type WordSentence struct {
	ID      int    `json:"id"`
	Type    int    `json:"type"`
	EN      string `json:"en"`
	CN      string `json:"cn"`
	From    string `json:"from"`
	TTSURL  string `json:"ttsUrl"`
	TTSSize int    `json:"ttsSize"`
	LikeNum int    `json:"likeNum"`
}

type WordSentenceGroup struct {
	Tag       string         `json:"tag"`
	Word      string         `json:"word"`
	Meaning   string         `json:"meaning"`
	Sentences []WordSentence `json:"sentences"`
}

type WordInfo struct {
	ID             int64               `json:"id"`
	Word           string              `json:"word"`
	PhEn           string              `json:"ph_en"`
	PhAm           string              `json:"ph_am"`
	MeanTag        string              `json:"mean_tag"`
	EnAudioURL     string              `json:"en_audio_url"`
	AmAudioURL     string              `json:"am_audio_url"`
	Parts          []WordPart          `json:"parts"`
	SentenceGroups []WordSentenceGroup `json:"sentence_groups"`
}

type UnitInfo struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	ReciteDate string `json:"recite_date"`
	CreatedAt  string `json:"created_at"`
}

type ClientConfig struct {
	DefaultAccent       string `json:"default_accent"`
	ReviewIntervalsDays []int  `json:"review_intervals_days"`
}

type UnitWordItem struct {
	Seq            int                 `json:"seq"`
	WordID         int64               `json:"word_id"`
	Word           string              `json:"word"`
	PhEn           string              `json:"ph_en"`
	PhAm           string              `json:"ph_am"`
	MeanTag        string              `json:"mean_tag"`
	EnAudio        string              `json:"en_audio"`
	AmAudio        string              `json:"am_audio"`
	Parts          []WordPart          `json:"parts"`
	SentenceGroups []WordSentenceGroup `json:"sentence_groups"`
}

type ReviewUnitSummary struct {
	UnitID       int64  `json:"unit_id"`
	Name         string `json:"name"`
	WordCount    int    `json:"word_count"`
	ReciteDate   string `json:"recite_date"`
	DistanceDays int    `json:"distance_days"`
}

type QuizWordItem struct {
	Seq         int          `json:"seq"`
	WordStatus  string       `json:"word_status"`
	InputAnswer string       `json:"input_answer"`
	Result      string       `json:"result"`
	WordDetail  UnitWordItem `json:"word_detail"`
}

type QuizStats struct {
	Total     int `json:"total"`
	Tested    int `json:"tested"`
	Correct   int `json:"correct"`
	Wrong     int `json:"wrong"`
	Forgotten int `json:"forgotten"`
}

type QuizInfo struct {
	ID         int64     `json:"id"`
	Type       string    `json:"type"`
	Title      string    `json:"title"`
	Status     string    `json:"status"`
	CreatedAt  string    `json:"created_at"`
	Source     string    `json:"source"`
	ReviewDate string    `json:"review_date"`
	Stats      QuizStats `json:"stats"`
	NextSeq    int       `json:"next_seq"`
}

type QuizDetail struct {
	Quiz  QuizInfo       `json:"quiz"`
	Words []QuizWordItem `json:"words"`
}

type QuizListItem struct {
	ID        int64     `json:"id"`
	Type      string    `json:"type"`
	Title     string    `json:"title"`
	Status    string    `json:"status"`
	Source    string    `json:"source"`
	CreatedAt string    `json:"created_at"`
	Stats     QuizStats `json:"stats"`
	NextSeq   int       `json:"next_seq"`
}

type StartQuizRequest struct {
	Type       string `json:"type"`
	SourceKind string `json:"source_kind"`
	UnitID     int64  `json:"unit_id"`
	ReviewDate string `json:"review_date"`
}
