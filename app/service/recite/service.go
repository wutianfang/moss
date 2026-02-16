package recite

import (
	"context"
	"math/rand"
	"regexp"
	"strings"
	"time"

	"github.com/wutianfang/moss/infra/recite/entity"
	"github.com/wutianfang/moss/infra/recite/fetcher"
	"github.com/wutianfang/moss/infra/recite/repository"
)

const datetimeLayout = "2006-01-02 15:04:05"

var validWord = regexp.MustCompile(`^[a-z][a-z'-]*$`)

type Service struct {
	wordRepo     *repository.WordRepository
	unitRepo     *repository.UnitRepository
	unitWordRepo *repository.UnitWordRepository
	wordFetcher  fetcher.WordFetcher
}

func NewService(
	wordRepo *repository.WordRepository,
	unitRepo *repository.UnitRepository,
	unitWordRepo *repository.UnitWordRepository,
	wordFetcher fetcher.WordFetcher,
) *Service {
	return &Service{
		wordRepo:     wordRepo,
		unitRepo:     unitRepo,
		unitWordRepo: unitWordRepo,
		wordFetcher:  wordFetcher,
	}
}

func (s *Service) ListUnits(ctx context.Context) ([]UnitInfo, error) {
	rows, err := s.unitRepo.List(ctx)
	if err != nil {
		return nil, err
	}
	ret := make([]UnitInfo, 0, len(rows))
	for _, row := range rows {
		ret = append(ret, UnitInfo{
			ID:        row.ID,
			Name:      row.Name,
			CreatedAt: row.CreatedAt.Format(datetimeLayout),
		})
	}
	return ret, nil
}

func (s *Service) CreateUnit(ctx context.Context, name string) (*UnitInfo, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, NewBizError(1001, "单元名称不能为空")
	}
	unit, err := s.unitRepo.Create(ctx, name)
	if err != nil {
		return nil, err
	}
	return &UnitInfo{
		ID:        unit.ID,
		Name:      unit.Name,
		CreatedAt: unit.CreatedAt.Format(datetimeLayout),
	}, nil
}

func (s *Service) RenameUnit(ctx context.Context, unitID int64, name string) error {
	if unitID <= 0 {
		return NewBizError(1001, "unit_id 非法")
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return NewBizError(1001, "单元名称不能为空")
	}
	unit, err := s.unitRepo.GetByID(ctx, unitID)
	if err != nil {
		return err
	}
	if unit == nil {
		return NewBizError(1002, "单元不存在")
	}
	return s.unitRepo.Rename(ctx, unitID, name)
}

func (s *Service) QueryWord(ctx context.Context, rawWord string) (*WordInfo, error) {
	word := strings.ToLower(strings.TrimSpace(rawWord))
	if word == "" {
		return nil, NewBizError(1001, "单词不能为空")
	}
	if !validWord.MatchString(word) {
		return nil, NewBizError(1001, "单词格式非法，仅支持英文字母/单引号/短横线")
	}

	cached, err := s.wordRepo.GetByWord(ctx, word)
	if err != nil {
		return nil, err
	}
	if cached != nil {
		result := buildWordInfo(cached)
		return &result, nil
	}

	fetched, err := s.wordFetcher.FetchAndStore(ctx, word)
	if err != nil {
		return nil, NewBizError(1003, "查词失败: %v", err)
	}
	if err := s.wordRepo.Create(ctx, fetched); err != nil {
		cached, qErr := s.wordRepo.GetByWord(ctx, word)
		if qErr == nil && cached != nil {
			result := buildWordInfo(cached)
			return &result, nil
		}
		return nil, err
	}
	result := buildWordInfo(fetched)
	return &result, nil
}

func (s *Service) AddWordToUnit(ctx context.Context, unitID int64, rawWord string) error {
	if unitID <= 0 {
		return NewBizError(1001, "unit_id 非法")
	}
	unit, err := s.unitRepo.GetByID(ctx, unitID)
	if err != nil {
		return err
	}
	if unit == nil {
		return NewBizError(1002, "单元不存在")
	}

	wordInfo, err := s.QueryWord(ctx, rawWord)
	if err != nil {
		return err
	}
	return s.unitWordRepo.Add(ctx, unitID, wordInfo.ID)
}

func (s *Service) ListUnitWords(ctx context.Context, unitID int64) ([]UnitWordItem, error) {
	if unitID <= 0 {
		return nil, NewBizError(1001, "unit_id 非法")
	}
	unit, err := s.unitRepo.GetByID(ctx, unitID)
	if err != nil {
		return nil, err
	}
	if unit == nil {
		return nil, NewBizError(1002, "单元不存在")
	}

	relations, err := s.unitWordRepo.ListByUnitID(ctx, unitID)
	if err != nil {
		return nil, err
	}
	if len(relations) == 0 {
		return []UnitWordItem{}, nil
	}

	ids := make([]int64, 0, len(relations))
	for _, relation := range relations {
		ids = append(ids, relation.WordID)
	}
	wordMap, err := s.wordRepo.GetByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}

	ret := make([]UnitWordItem, 0, len(relations))
	for _, relation := range relations {
		word := wordMap[relation.WordID]
		if word == nil {
			continue
		}
		ret = append(ret, buildUnitWordItem(word, len(ret)+1))
	}
	return ret, nil
}

func (s *Service) GetDictationWords(ctx context.Context, unitID int64) ([]UnitWordItem, error) {
	words, err := s.ListUnitWords(ctx, unitID)
	if err != nil {
		return nil, err
	}
	if len(words) <= 1 {
		return words, nil
	}

	ret := make([]UnitWordItem, len(words))
	copy(ret, words)
	rand.New(rand.NewSource(time.Now().UnixNano())).Shuffle(len(ret), func(i, j int) {
		ret[i], ret[j] = ret[j], ret[i]
	})
	for i := range ret {
		ret[i].Seq = i + 1
	}
	return ret, nil
}

func buildWordInfo(row *entity.Word) WordInfo {
	parts := make([]WordPart, 0, len(row.Parts))
	for _, part := range row.Parts {
		parts = append(parts, WordPart{Part: part.Part, Means: part.Means})
	}
	sentenceGroups := make([]WordSentenceGroup, 0, len(row.SentenceGroups))
	for _, group := range row.SentenceGroups {
		sentences := make([]WordSentence, 0, len(group.Sentences))
		for _, sentence := range group.Sentences {
			sentences = append(sentences, WordSentence{
				ID:      sentence.ID,
				Type:    sentence.Type,
				EN:      sentence.EN,
				CN:      sentence.CN,
				From:    sentence.From,
				TTSURL:  sentence.TTSURL,
				TTSSize: sentence.TTSSize,
				LikeNum: sentence.LikeNum,
			})
		}
		sentenceGroups = append(sentenceGroups, WordSentenceGroup{
			Tag:       group.Tag,
			Word:      group.Word,
			Meaning:   group.Meaning,
			Sentences: sentences,
		})
	}
	return WordInfo{
		ID:             row.ID,
		Word:           row.Word,
		PhEn:           row.PhEn,
		PhAm:           row.PhAm,
		MeanTag:        row.MeanTag,
		EnAudioURL:     buildAudioURL(row.Word, "en"),
		AmAudioURL:     buildAudioURL(row.Word, "am"),
		Parts:          parts,
		SentenceGroups: sentenceGroups,
	}
}

func buildUnitWordItem(row *entity.Word, seq int) UnitWordItem {
	wordInfo := buildWordInfo(row)
	return UnitWordItem{
		Seq:            seq,
		Word:           wordInfo.Word,
		PhEn:           wordInfo.PhEn,
		PhAm:           wordInfo.PhAm,
		MeanTag:        wordInfo.MeanTag,
		EnAudio:        wordInfo.EnAudioURL,
		AmAudio:        wordInfo.AmAudioURL,
		Parts:          wordInfo.Parts,
		SentenceGroups: wordInfo.SentenceGroups,
	}
}

func buildAudioURL(word, prefix string) string {
	return "/word_mp3/" + prefix + "/" + buildWordPrefix(word) + "/" + word + ".mp3"
}

func buildWordPrefix(word string) string {
	runes := []rune(word)
	if len(runes) < 2 {
		return word
	}
	return string(runes[:2])
}
