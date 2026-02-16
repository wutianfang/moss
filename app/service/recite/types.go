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
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	CreatedAt string `json:"created_at"`
}

type UnitWordItem struct {
	Seq            int                 `json:"seq"`
	Word           string              `json:"word"`
	PhEn           string              `json:"ph_en"`
	PhAm           string              `json:"ph_am"`
	MeanTag        string              `json:"mean_tag"`
	EnAudio        string              `json:"en_audio"`
	AmAudio        string              `json:"am_audio"`
	Parts          []WordPart          `json:"parts"`
	SentenceGroups []WordSentenceGroup `json:"sentence_groups"`
}
