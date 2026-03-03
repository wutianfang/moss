package recite

import (
	"context"
	"database/sql"
	"fmt"
	"math/rand"
	"regexp"
	"strings"
	"time"

	"github.com/wutianfang/moss/infra/recite/entity"
	"github.com/wutianfang/moss/infra/recite/fetcher"
	"github.com/wutianfang/moss/infra/recite/repository"
	"github.com/wutianfang/moss/util"
)

const datetimeLayout = "2006-01-02 15:04:05"

const (
	quizTypeDictation = "读写"
	quizTypeSpelling  = "默写"

	quizStatusRunning  = "进行中"
	quizStatusFinished = "已完结"

	quizWordStatusPending = "未测试"
	quizWordStatusDone    = "已测试"

	quizResultCorrect   = "正确"
	quizResultWrong     = "错误"
	quizResultForgotten = "忘记"

	quizSourceUnit      = "unit"
	quizSourceForgotten = "forgotten"
	quizSourceReview    = "review"
)

var validWord = regexp.MustCompile(`^[a-z][a-z'-]*$`)

type Service struct {
	wordRepo        *repository.WordRepository
	unitRepo        *repository.UnitRepository
	unitWordRepo    *repository.UnitWordRepository
	forgottenRepo   *repository.ForgottenWordRepository
	quizRepo        *repository.QuizRepository
	noteRepo        *repository.NoteRepository
	wordFetcher     fetcher.WordFetcher
	defaultAccent   string
	reviewIntervals []int
	noteTypes       []string
}

func NewService(
	wordRepo *repository.WordRepository,
	unitRepo *repository.UnitRepository,
	unitWordRepo *repository.UnitWordRepository,
	forgottenRepo *repository.ForgottenWordRepository,
	quizRepo *repository.QuizRepository,
	noteRepo *repository.NoteRepository,
	wordFetcher fetcher.WordFetcher,
	defaultAccent string,
	reviewIntervals []int,
	noteTypes []string,
) *Service {
	return &Service{
		wordRepo:        wordRepo,
		unitRepo:        unitRepo,
		unitWordRepo:    unitWordRepo,
		forgottenRepo:   forgottenRepo,
		quizRepo:        quizRepo,
		noteRepo:        noteRepo,
		wordFetcher:     wordFetcher,
		defaultAccent:   normalizeAccent(defaultAccent),
		reviewIntervals: normalizeReviewIntervals(reviewIntervals),
		noteTypes:       normalizeNoteTypes(noteTypes),
	}
}

func (s *Service) GetClientConfig() ClientConfig {
	return ClientConfig{
		DefaultAccent:       normalizeAccent(s.defaultAccent),
		ReviewIntervalsDays: append([]int{}, s.reviewIntervals...),
		NoteTypes:           append([]string{}, s.noteTypes...),
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
			ID:         row.ID,
			Name:       row.Name,
			ReciteDate: formatOptionalDate(row.ReciteDate),
			CreatedAt:  row.CreatedAt.Format(datetimeLayout),
		})
	}
	return ret, nil
}

func (s *Service) CreateUnit(ctx context.Context, name, reciteDate string) (*UnitInfo, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, NewBizError(1001, "单元名称不能为空")
	}
	reciteDatePtr, err := parseOptionalDate(reciteDate)
	if err != nil {
		return nil, err
	}
	unit, err := s.unitRepo.Create(ctx, name, reciteDatePtr)
	if err != nil {
		return nil, err
	}
	return &UnitInfo{
		ID:         unit.ID,
		Name:       unit.Name,
		ReciteDate: formatOptionalDate(unit.ReciteDate),
		CreatedAt:  unit.CreatedAt.Format(datetimeLayout),
	}, nil
}

func (s *Service) RenameUnit(ctx context.Context, unitID int64, name, reciteDate string) error {
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
	reciteDatePtr, parseErr := parseOptionalDate(reciteDate)
	if parseErr != nil {
		return parseErr
	}
	return s.unitRepo.Rename(ctx, unitID, name, reciteDatePtr)
}

func (s *Service) ReorderUnits(ctx context.Context, unitIDs []int64) error {
	if len(unitIDs) == 0 {
		return NewBizError(1001, "排序列表不能为空")
	}

	seen := make(map[int64]struct{}, len(unitIDs))
	for _, id := range unitIDs {
		if id <= 0 {
			return NewBizError(1001, "unit_id 非法")
		}
		if _, ok := seen[id]; ok {
			return NewBizError(1001, "排序列表包含重复单元")
		}
		seen[id] = struct{}{}
	}

	total, err := s.unitRepo.Count(ctx)
	if err != nil {
		return err
	}
	if int64(len(unitIDs)) != total {
		return NewBizError(1001, "排序列表必须包含全部单元")
	}

	if err := s.unitRepo.Reorder(ctx, unitIDs); err != nil {
		return err
	}
	return nil
}

func (s *Service) DeleteUnit(ctx context.Context, unitID int64) error {
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
	return s.unitRepo.Delete(ctx, unitID)
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
		_ = s.wordFetcher.EnsureAudioFiles(ctx, cached.Word)
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
			_ = s.wordFetcher.EnsureAudioFiles(ctx, cached.Word)
			result := buildWordInfo(cached)
			return &result, nil
		}
		return nil, err
	}
	_ = s.wordFetcher.EnsureAudioFiles(ctx, fetched.Word)
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
	util.InfofWithRequest(ctx, "recite.list_unit_words.begin", "unit_id=%d", unitID)
	if unitID <= 0 {
		util.InfofWithRequest(ctx, "recite.list_unit_words.invalid_unit_id", "unit_id=%d", unitID)
		return nil, NewBizError(1001, "unit_id 非法")
	}
	unit, err := s.unitRepo.GetByID(ctx, unitID)
	if err != nil {
		util.ErrorfWithRequest(ctx, "recite.list_unit_words.get_unit_failed", "unit_id=%d err=%v", unitID, err)
		return nil, err
	}
	util.InfofWithRequest(ctx, "recite.list_unit_words.after_get_unit", "unit_exists=%t", unit != nil)
	if unit == nil {
		return nil, NewBizError(1002, "单元不存在")
	}

	relations, err := s.unitWordRepo.ListByUnitID(ctx, unitID)
	if err != nil {
		util.ErrorfWithRequest(ctx, "recite.list_unit_words.list_relations_failed", "unit_id=%d err=%v", unitID, err)
		return nil, err
	}
	util.InfofWithRequest(ctx, "recite.list_unit_words.after_list_relations", "relation_count=%d", len(relations))
	ret, err := s.buildUnitWordItemsFromRelations(ctx, relations)
	if err != nil {
		util.ErrorfWithRequest(ctx, "recite.list_unit_words.get_words_failed", "unit_id=%d relations=%d err=%v", unitID, len(relations), err)
		return nil, err
	}
	util.InfofWithRequest(ctx, "recite.list_unit_words.finish", "output_count=%d", len(ret))
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

func (s *Service) AddForgottenWord(ctx context.Context, rawWord string) error {
	word, err := normalizeWord(rawWord)
	if err != nil {
		return err
	}
	if _, err := s.QueryWord(ctx, word); err != nil {
		return err
	}
	return s.forgottenRepo.Add(ctx, word)
}

func (s *Service) ListForgottenWords(ctx context.Context) ([]UnitWordItem, error) {
	words, err := s.forgottenRepo.ListUnrememberedDistinct(ctx)
	if err != nil {
		return nil, err
	}
	return s.listWordsByText(ctx, words)
}

func (s *Service) RememberForgottenWord(ctx context.Context, rawWord string) error {
	word, err := normalizeWord(rawWord)
	if err != nil {
		return err
	}
	return s.forgottenRepo.MarkRememberedByWord(ctx, word)
}

func (s *Service) GetForgottenDictationWords(ctx context.Context) ([]UnitWordItem, error) {
	words, err := s.ListForgottenWords(ctx)
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

func (s *Service) ListReviewDateOptions(recentDays int) []string {
	if recentDays <= 0 {
		recentDays = 7
	}
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	ret := make([]string, 0, recentDays)
	for i := 0; i < recentDays; i++ {
		ret = append(ret, today.AddDate(0, 0, -i).Format("2006-01-02"))
	}
	return ret
}

func (s *Service) ListReviewWordsByDate(ctx context.Context, rawDate string) ([]UnitWordItem, []ReviewUnitSummary, error) {
	util.InfofWithRequest(ctx, "recite.list_review_words.begin", "raw_date=%q", strings.TrimSpace(rawDate))
	targetDate, err := parseReviewDate(rawDate)
	if err != nil {
		util.InfofWithRequest(ctx, "recite.list_review_words.invalid_date", "raw_date=%q err=%v", strings.TrimSpace(rawDate), err)
		return nil, nil, err
	}
	util.InfofWithRequest(
		ctx,
		"recite.list_review_words.after_parse_date",
		"target_date=%s interval_count=%d intervals=%v",
		targetDate.Format("2006-01-02"),
		len(s.reviewIntervals),
		s.reviewIntervals,
	)
	units, err := s.unitRepo.ListReviewByDate(ctx, targetDate, s.reviewIntervals)
	if err != nil {
		util.ErrorfWithRequest(
			ctx,
			"recite.list_review_words.list_units_failed",
			"target_date=%s interval_count=%d err=%v",
			targetDate.Format("2006-01-02"),
			len(s.reviewIntervals),
			err,
		)
		return nil, nil, err
	}
	util.InfofWithRequest(ctx, "recite.list_review_words.after_list_units", "unit_count=%d", len(units))
	if len(units) == 0 {
		util.InfofWithRequest(ctx, "recite.list_review_words.finish", "output_count=0 review_unit_count=0")
		return []UnitWordItem{}, []ReviewUnitSummary{}, nil
	}
	unitIDs := make([]int64, 0, len(units))
	for _, u := range units {
		unitIDs = append(unitIDs, u.ID)
	}
	util.InfofWithRequest(ctx, "recite.list_review_words.after_collect_unit_ids", "unit_id_count=%d", len(unitIDs))
	relations, err := s.unitWordRepo.ListByUnitIDs(ctx, unitIDs)
	if err != nil {
		util.ErrorfWithRequest(
			ctx,
			"recite.list_review_words.list_relations_failed",
			"unit_id_count=%d err=%v",
			len(unitIDs),
			err,
		)
		return nil, nil, err
	}
	util.InfofWithRequest(ctx, "recite.list_review_words.after_list_relations", "relation_count=%d", len(relations))
	words, err := s.buildUnitWordItemsFromRelations(ctx, relations)
	if err != nil {
		util.ErrorfWithRequest(
			ctx,
			"recite.list_review_words.build_words_failed",
			"relation_count=%d err=%v",
			len(relations),
			err,
		)
		return nil, nil, err
	}
	util.InfofWithRequest(ctx, "recite.list_review_words.after_build_words", "word_count=%d", len(words))
	reviewUnits := buildReviewUnitSummary(units, relations, targetDate)
	util.InfofWithRequest(ctx, "recite.list_review_words.after_build_summary", "review_unit_count=%d", len(reviewUnits))
	util.InfofWithRequest(ctx, "recite.list_review_words.finish", "output_count=%d review_unit_count=%d", len(words), len(reviewUnits))
	return words, reviewUnits, nil
}

func (s *Service) GetReviewDictationWordsByDate(ctx context.Context, rawDate string) ([]UnitWordItem, error) {
	words, _, err := s.ListReviewWordsByDate(ctx, rawDate)
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

func (s *Service) StartQuiz(ctx context.Context, req StartQuizRequest) (*QuizDetail, error) {
	if s.quizRepo == nil {
		return nil, NewBizError(1, "测验仓储未初始化")
	}
	quizType, err := normalizeQuizType(req.Type)
	if err != nil {
		return nil, err
	}
	sourceKind, err := normalizeQuizSourceKind(req.SourceKind)
	if err != nil {
		return nil, err
	}

	words, sourceName, sourceUnitID, sourceReviewDate, err := s.listQuizSourceWords(ctx, sourceKind, req.UnitID, req.ReviewDate)
	if err != nil {
		return nil, err
	}
	if len(words) == 0 {
		return nil, NewBizError(1002, "暂无可测试单词")
	}

	wordIDs := make([]int64, 0, len(words))
	for _, row := range words {
		if row.WordID <= 0 {
			return nil, NewBizError(1, "单词ID异常")
		}
		wordIDs = append(wordIDs, row.WordID)
	}

	quizTitle := fmt.Sprintf("%s-%s-%s", quizType, sourceName, time.Now().Format("01/02"))
	createdQuiz, err := s.quizRepo.Create(ctx, &entity.Quiz{
		QuizType:         quizType,
		Title:            quizTitle,
		Status:           quizStatusRunning,
		SourceKind:       sourceKind,
		SourceUnitID:     sourceUnitID,
		SourceReviewDate: sourceReviewDate,
	}, wordIDs)
	if err != nil {
		return nil, err
	}
	return s.GetQuizDetail(ctx, createdQuiz.ID)
}

func (s *Service) SubmitQuizWord(
	ctx context.Context,
	quizID int64,
	seq int,
	inputAnswer string,
	result string,
) error {
	if s.quizRepo == nil {
		return NewBizError(1, "测验仓储未初始化")
	}
	if quizID <= 0 {
		return NewBizError(1001, "quiz_id 非法")
	}
	if seq <= 0 {
		return NewBizError(1001, "seq 非法")
	}

	quiz, err := s.quizRepo.GetByID(ctx, quizID)
	if err != nil {
		return err
	}
	if quiz == nil {
		return NewBizError(1002, "测验不存在")
	}
	if quiz.Status != quizStatusRunning {
		return NewBizError(1001, "测验已完结")
	}

	normalizedResult, err := normalizeQuizResult(result)
	if err != nil {
		return err
	}
	if err := s.quizRepo.UpdateWordResult(ctx, quizID, seq, strings.TrimSpace(inputAnswer), normalizedResult); err != nil {
		if err == sql.ErrNoRows {
			return NewBizError(1002, "测验单词不存在")
		}
		return err
	}
	return nil
}

func (s *Service) FinishQuiz(ctx context.Context, quizID int64) (*QuizDetail, error) {
	if s.quizRepo == nil {
		return nil, NewBizError(1, "测验仓储未初始化")
	}
	if quizID <= 0 {
		return nil, NewBizError(1001, "quiz_id 非法")
	}
	quiz, err := s.quizRepo.GetByID(ctx, quizID)
	if err != nil {
		return nil, err
	}
	if quiz == nil {
		return nil, NewBizError(1002, "测验不存在")
	}
	if err := s.quizRepo.Finish(ctx, quizID); err != nil {
		return nil, err
	}
	return s.GetQuizDetail(ctx, quizID)
}

func (s *Service) GetQuizDetail(ctx context.Context, quizID int64) (*QuizDetail, error) {
	if s.quizRepo == nil {
		return nil, NewBizError(1, "测验仓储未初始化")
	}
	if quizID <= 0 {
		return nil, NewBizError(1001, "quiz_id 非法")
	}
	quiz, err := s.quizRepo.GetByID(ctx, quizID)
	if err != nil {
		return nil, err
	}
	if quiz == nil {
		return nil, NewBizError(1002, "测验不存在")
	}

	quizWords, err := s.quizRepo.ListWords(ctx, quizID)
	if err != nil {
		return nil, err
	}
	wordIDs := make([]int64, 0, len(quizWords))
	for _, row := range quizWords {
		wordIDs = append(wordIDs, row.WordID)
	}
	wordMap, err := s.wordRepo.GetByIDs(ctx, wordIDs)
	if err != nil {
		return nil, err
	}

	words := make([]QuizWordItem, 0, len(quizWords))
	stats := QuizStats{Total: len(quizWords)}
	nextSeq := 0
	for _, row := range quizWords {
		detail := UnitWordItem{
			Seq:    row.OrderNo,
			WordID: row.WordID,
		}
		if word := wordMap[row.WordID]; word != nil {
			detail = buildUnitWordItem(word, row.OrderNo)
		}

		if row.Status == quizWordStatusDone {
			stats.Tested++
		}
		switch row.Result {
		case quizResultCorrect:
			stats.Correct++
		case quizResultForgotten:
			stats.Forgotten++
		case quizResultWrong:
			stats.Wrong++
		}
		if nextSeq == 0 && row.Status == quizWordStatusPending {
			nextSeq = row.OrderNo
		}
		words = append(words, QuizWordItem{
			Seq:         row.OrderNo,
			WordStatus:  row.Status,
			InputAnswer: row.InputAnswer,
			Result:      row.Result,
			WordDetail:  detail,
		})
	}
	reviewDate := ""
	if quiz.SourceReviewDate != nil {
		reviewDate = quiz.SourceReviewDate.Format("2006-01-02")
	}

	return &QuizDetail{
		Quiz: QuizInfo{
			ID:         quiz.ID,
			Type:       quiz.QuizType,
			Title:      quiz.Title,
			Status:     quiz.Status,
			CreatedAt:  quiz.CreatedAt.Format(datetimeLayout),
			Source:     quiz.SourceKind,
			ReviewDate: reviewDate,
			Stats:      stats,
			NextSeq:    nextSeq,
		},
		Words: words,
	}, nil
}

func (s *Service) ListQuizzes(
	ctx context.Context,
	page int,
	pageSize int,
) ([]QuizListItem, int64, bool, error) {
	if s.quizRepo == nil {
		return nil, 0, false, NewBizError(1, "测验仓储未初始化")
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 200 {
		pageSize = 200
	}
	offset := (page - 1) * pageSize
	rows, total, err := s.quizRepo.List(ctx, pageSize, offset)
	if err != nil {
		return nil, 0, false, err
	}
	hasRunning, err := s.quizRepo.HasRunning(ctx)
	if err != nil {
		return nil, 0, false, err
	}

	ret := make([]QuizListItem, 0, len(rows))
	for _, row := range rows {
		nextSeq := 0
		if row.Quiz.Status == quizStatusRunning && row.TotalWords > row.TestedWords {
			nextSeq = row.TestedWords + 1
		}
		ret = append(ret, QuizListItem{
			ID:        row.Quiz.ID,
			Type:      row.Quiz.QuizType,
			Title:     row.Quiz.Title,
			Status:    row.Quiz.Status,
			Source:    row.Quiz.SourceKind,
			CreatedAt: row.Quiz.CreatedAt.Format(datetimeLayout),
			Stats: QuizStats{
				Total:     row.TotalWords,
				Tested:    row.TestedWords,
				Correct:   row.CorrectCount,
				Wrong:     row.WrongCount,
				Forgotten: row.ForgottenCount,
			},
			NextSeq: nextSeq,
		})
	}
	return ret, total, hasRunning, nil
}

func (s *Service) HasRunningQuiz(ctx context.Context) (bool, error) {
	if s.quizRepo == nil {
		return false, NewBizError(1, "测验仓储未初始化")
	}
	return s.quizRepo.HasRunning(ctx)
}

func (s *Service) CreateNote(ctx context.Context, noteType, content string, wordIDs []int64) (*NoteDetail, error) {
	if s.noteRepo == nil {
		return nil, NewBizError(1, "笔记仓储未初始化")
	}
	normalizedType, err := s.normalizeNoteTypeChoice(noteType)
	if err != nil {
		return nil, err
	}
	normalizedContent := strings.TrimSpace(content)
	if normalizedContent == "" {
		return nil, NewBizError(1001, "笔记内容不能为空")
	}
	normalizedWordIDs, err := s.normalizeWordIDs(ctx, wordIDs)
	if err != nil {
		return nil, err
	}
	created, err := s.noteRepo.Create(ctx, normalizedType, normalizedContent, normalizedWordIDs)
	if err != nil {
		return nil, err
	}
	return s.GetNoteDetail(ctx, created.ID)
}

func (s *Service) UpdateNote(ctx context.Context, noteID int64, noteType, content string, wordIDs []int64) (*NoteDetail, error) {
	if s.noteRepo == nil {
		return nil, NewBizError(1, "笔记仓储未初始化")
	}
	if noteID <= 0 {
		return nil, NewBizError(1001, "note_id 非法")
	}
	exist, err := s.noteRepo.GetByID(ctx, noteID)
	if err != nil {
		return nil, err
	}
	if exist == nil {
		return nil, NewBizError(1002, "笔记不存在")
	}

	normalizedType, err := s.normalizeNoteTypeChoice(noteType)
	if err != nil {
		return nil, err
	}
	normalizedContent := strings.TrimSpace(content)
	if normalizedContent == "" {
		return nil, NewBizError(1001, "笔记内容不能为空")
	}
	normalizedWordIDs, err := s.normalizeWordIDs(ctx, wordIDs)
	if err != nil {
		return nil, err
	}
	if err := s.noteRepo.Update(ctx, noteID, normalizedType, normalizedContent, normalizedWordIDs); err != nil {
		return nil, err
	}
	return s.GetNoteDetail(ctx, noteID)
}

func (s *Service) GetNoteDetail(ctx context.Context, noteID int64) (*NoteDetail, error) {
	if s.noteRepo == nil {
		return nil, NewBizError(1, "笔记仓储未初始化")
	}
	if noteID <= 0 {
		return nil, NewBizError(1001, "note_id 非法")
	}
	note, err := s.noteRepo.GetByID(ctx, noteID)
	if err != nil {
		return nil, err
	}
	if note == nil {
		return nil, NewBizError(1002, "笔记不存在")
	}
	relations, err := s.noteRepo.ListWordRelationsByNoteID(ctx, noteID)
	if err != nil {
		return nil, err
	}
	wordIDs := make([]int64, 0, len(relations))
	for _, rel := range relations {
		wordIDs = append(wordIDs, rel.WordID)
	}
	words, err := s.buildUnitWordItemsByWordIDs(ctx, wordIDs)
	if err != nil {
		return nil, err
	}
	return &NoteDetail{
		ID:        note.ID,
		Type:      note.NoteType,
		Content:   note.Content,
		CreatedAt: note.CreatedAt.Format(datetimeLayout),
		UpdatedAt: note.UpdatedAt.Format(datetimeLayout),
		Words:     words,
	}, nil
}

func (s *Service) ListNotes(ctx context.Context, page, pageSize int) ([]NoteListItem, int64, error) {
	if s.noteRepo == nil {
		return nil, 0, NewBizError(1, "笔记仓储未初始化")
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 200 {
		pageSize = 200
	}
	offset := (page - 1) * pageSize
	rows, total, err := s.noteRepo.List(ctx, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}

	noteIDs := make([]int64, 0, len(rows))
	for _, row := range rows {
		noteIDs = append(noteIDs, row.Note.ID)
	}
	relations, err := s.noteRepo.ListWordRelationsByNoteIDs(ctx, noteIDs)
	if err != nil {
		return nil, 0, err
	}
	wordIDs := make([]int64, 0, len(relations))
	for _, rel := range relations {
		wordIDs = append(wordIDs, rel.WordID)
	}
	wordMap, err := s.wordRepo.GetByIDs(ctx, wordIDs)
	if err != nil {
		return nil, 0, err
	}
	wordTextsByNote := make(map[int64][]string, len(rows))
	for _, rel := range relations {
		word := wordMap[rel.WordID]
		if word == nil {
			continue
		}
		wordTextsByNote[rel.NoteID] = append(wordTextsByNote[rel.NoteID], word.Word)
	}

	ret := make([]NoteListItem, 0, len(rows))
	for _, row := range rows {
		ret = append(ret, NoteListItem{
			ID:        row.Note.ID,
			Type:      row.Note.NoteType,
			Content:   row.Note.Content,
			Words:     wordTextsByNote[row.Note.ID],
			CreatedAt: row.Note.CreatedAt.Format(datetimeLayout),
		})
	}
	return ret, total, nil
}

func (s *Service) ListNotesByWordIDs(ctx context.Context, wordIDs []int64) (map[int64][]NoteTag, error) {
	if s.noteRepo == nil {
		return nil, NewBizError(1, "笔记仓储未初始化")
	}
	normalizedWordIDs, err := s.normalizeWordIDsFast(wordIDs)
	if err != nil {
		return nil, err
	}
	if len(normalizedWordIDs) == 0 {
		return map[int64][]NoteTag{}, nil
	}
	rows, err := s.noteRepo.ListByWordIDs(ctx, normalizedWordIDs)
	if err != nil {
		return nil, err
	}
	ret := make(map[int64][]NoteTag, len(rows))
	for wordID, notes := range rows {
		items := make([]NoteTag, 0, len(notes))
		for _, note := range notes {
			items = append(items, NoteTag{
				ID:   note.ID,
				Type: note.NoteType,
			})
		}
		ret[wordID] = items
	}
	return ret, nil
}

func (s *Service) listQuizSourceWords(
	ctx context.Context,
	sourceKind string,
	unitID int64,
	reviewDate string,
) ([]UnitWordItem, string, int64, *time.Time, error) {
	switch sourceKind {
	case quizSourceForgotten:
		words, err := s.GetForgottenDictationWords(ctx)
		return words, "遗忘单词", 0, nil, err
	case quizSourceReview:
		targetDate, err := parseReviewDate(reviewDate)
		if err != nil {
			return nil, "", 0, nil, err
		}
		words, err := s.GetReviewDictationWordsByDate(ctx, targetDate.Format("2006-01-02"))
		if err != nil {
			return nil, "", 0, nil, err
		}
		reviewDateValue := time.Date(targetDate.Year(), targetDate.Month(), targetDate.Day(), 0, 0, 0, 0, targetDate.Location())
		return words, "今日复习", 0, &reviewDateValue, nil
	default:
		if unitID <= 0 {
			return nil, "", 0, nil, NewBizError(1001, "unit_id 非法")
		}
		unit, err := s.unitRepo.GetByID(ctx, unitID)
		if err != nil {
			return nil, "", 0, nil, err
		}
		if unit == nil {
			return nil, "", 0, nil, NewBizError(1002, "单元不存在")
		}
		words, err := s.GetDictationWords(ctx, unitID)
		if err != nil {
			return nil, "", 0, nil, err
		}
		return words, unit.Name, unit.ID, nil, nil
	}
}

func normalizeQuizType(raw string) (string, error) {
	text := strings.TrimSpace(raw)
	switch text {
	case quizTypeDictation, "听写", "dictation":
		return quizTypeDictation, nil
	case quizTypeSpelling, "spelling":
		return quizTypeSpelling, nil
	default:
		return "", NewBizError(1001, "测验类型非法")
	}
}

func normalizeQuizSourceKind(raw string) (string, error) {
	text := strings.TrimSpace(raw)
	switch text {
	case quizSourceUnit:
		return quizSourceUnit, nil
	case quizSourceForgotten:
		return quizSourceForgotten, nil
	case quizSourceReview:
		return quizSourceReview, nil
	default:
		return "", NewBizError(1001, "测验来源非法")
	}
}

func normalizeQuizResult(raw string) (string, error) {
	text := strings.TrimSpace(raw)
	switch text {
	case quizResultCorrect:
		return quizResultCorrect, nil
	case quizResultWrong:
		return quizResultWrong, nil
	case quizResultForgotten, "记住", "operated":
		return quizResultForgotten, nil
	default:
		return "", NewBizError(1001, "测验结果非法")
	}
}

func normalizeNoteTypes(raw []string) []string {
	if len(raw) == 0 {
		return []string{"近义词", "反义词", "关联词跟"}
	}
	seen := make(map[string]struct{}, len(raw))
	ret := make([]string, 0, len(raw))
	for _, item := range raw {
		text := strings.TrimSpace(item)
		if text == "" {
			continue
		}
		if _, ok := seen[text]; ok {
			continue
		}
		seen[text] = struct{}{}
		ret = append(ret, text)
	}
	if len(ret) == 0 {
		return []string{"近义词", "反义词", "关联词跟"}
	}
	return ret
}

func (s *Service) normalizeNoteTypeChoice(raw string) (string, error) {
	text := strings.TrimSpace(raw)
	for _, item := range s.noteTypes {
		if text == item {
			return text, nil
		}
	}
	return "", NewBizError(1001, "笔记类型非法")
}

func (s *Service) normalizeWordIDs(ctx context.Context, wordIDs []int64) ([]int64, error) {
	if len(wordIDs) == 0 {
		return nil, NewBizError(1001, "关联单词不能为空")
	}
	seen := make(map[int64]struct{}, len(wordIDs))
	ret := make([]int64, 0, len(wordIDs))
	for _, id := range wordIDs {
		if id <= 0 {
			return nil, NewBizError(1001, "word_id 非法")
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ret = append(ret, id)
	}
	wordMap, err := s.wordRepo.GetByIDs(ctx, ret)
	if err != nil {
		return nil, err
	}
	if len(wordMap) != len(ret) {
		return nil, NewBizError(1002, "存在无效关联单词")
	}
	return ret, nil
}

func (s *Service) normalizeWordIDsFast(wordIDs []int64) ([]int64, error) {
	seen := make(map[int64]struct{}, len(wordIDs))
	ret := make([]int64, 0, len(wordIDs))
	for _, id := range wordIDs {
		if id <= 0 {
			return nil, NewBizError(1001, "word_id 非法")
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ret = append(ret, id)
	}
	return ret, nil
}

func normalizeWord(rawWord string) (string, error) {
	word := strings.ToLower(strings.TrimSpace(rawWord))
	if word == "" {
		return "", NewBizError(1001, "单词不能为空")
	}
	if !validWord.MatchString(word) {
		return "", NewBizError(1001, "单词格式非法，仅支持英文字母/单引号/短横线")
	}
	return word, nil
}

func normalizeAccent(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "am":
		return "am"
	default:
		return "en"
	}
}

func normalizeReviewIntervals(raw []int) []int {
	if len(raw) == 0 {
		return []int{1, 2, 4, 7, 15, 30}
	}
	seen := make(map[int]struct{}, len(raw))
	ret := make([]int, 0, len(raw))
	for _, d := range raw {
		if d <= 0 {
			continue
		}
		if _, ok := seen[d]; ok {
			continue
		}
		seen[d] = struct{}{}
		ret = append(ret, d)
	}
	if len(ret) == 0 {
		return []int{1, 2, 4, 7, 15, 30}
	}
	return ret
}

func (s *Service) listWordsByText(ctx context.Context, words []string) ([]UnitWordItem, error) {
	ret := make([]UnitWordItem, 0, len(words))
	for _, wordText := range words {
		row, err := s.wordRepo.GetByWord(ctx, wordText)
		if err != nil {
			return nil, err
		}
		if row == nil {
			continue
		}
		ret = append(ret, buildUnitWordItem(row, len(ret)+1))
	}
	return ret, nil
}

func (s *Service) buildUnitWordItemsFromRelations(ctx context.Context, relations []entity.UnitWordRelation) ([]UnitWordItem, error) {
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

func (s *Service) buildUnitWordItemsByWordIDs(ctx context.Context, wordIDs []int64) ([]UnitWordItem, error) {
	if len(wordIDs) == 0 {
		return []UnitWordItem{}, nil
	}
	wordMap, err := s.wordRepo.GetByIDs(ctx, wordIDs)
	if err != nil {
		return nil, err
	}
	ret := make([]UnitWordItem, 0, len(wordIDs))
	for _, wordID := range wordIDs {
		word := wordMap[wordID]
		if word == nil {
			continue
		}
		ret = append(ret, buildUnitWordItem(word, len(ret)+1))
	}
	return ret, nil
}

func parseOptionalDate(raw string) (*time.Time, error) {
	text := strings.TrimSpace(raw)
	if text == "" {
		return nil, nil
	}
	t, err := time.ParseInLocation("2006-01-02", text, time.Local)
	if err != nil {
		return nil, NewBizError(1001, "背诵时间格式错误，需为 yyyy-mm-dd")
	}
	value := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.Local)
	return &value, nil
}

func parseReviewDate(raw string) (time.Time, error) {
	text := strings.TrimSpace(raw)
	if text == "" {
		now := time.Now()
		return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()), nil
	}
	t, err := time.ParseInLocation("2006-01-02", text, time.Local)
	if err != nil {
		return time.Time{}, NewBizError(1001, "日期格式错误，需为 yyyy-mm-dd")
	}
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.Local), nil
}

func formatOptionalDate(date *time.Time) string {
	if date == nil {
		return ""
	}
	return date.Format("2006-01-02")
}

func buildReviewUnitSummary(
	units []entity.ReciteUnit,
	relations []entity.UnitWordRelation,
	targetDate time.Time,
) []ReviewUnitSummary {
	if len(units) == 0 {
		return []ReviewUnitSummary{}
	}
	countByUnit := make(map[int64]int, len(units))
	for _, rel := range relations {
		countByUnit[rel.UnitID]++
	}
	ret := make([]ReviewUnitSummary, 0, len(units))
	for _, unit := range units {
		reciteDateText := formatOptionalDate(unit.ReciteDate)
		distance := 0
		if unit.ReciteDate != nil {
			reciteDate := time.Date(unit.ReciteDate.Year(), unit.ReciteDate.Month(), unit.ReciteDate.Day(), 0, 0, 0, 0, targetDate.Location())
			distance = int(targetDate.Sub(reciteDate).Hours() / 24)
		}
		ret = append(ret, ReviewUnitSummary{
			UnitID:       unit.ID,
			Name:         unit.Name,
			WordCount:    countByUnit[unit.ID],
			ReciteDate:   reciteDateText,
			DistanceDays: distance,
		})
	}
	return ret
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
		WordID:         row.ID,
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
