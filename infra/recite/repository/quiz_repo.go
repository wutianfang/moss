package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/wutianfang/moss/infra/recite/entity"
)

type QuizListRow struct {
	Quiz           entity.Quiz
	TotalWords     int
	TestedWords    int
	CorrectCount   int
	WrongCount     int
	ForgottenCount int
}

type QuizRepository struct {
	db *sql.DB
}

func NewQuizRepository(db *sql.DB) *QuizRepository {
	return &QuizRepository{db: db}
}

func (r *QuizRepository) Create(ctx context.Context, quiz *entity.Quiz, wordIDs []int64) (*entity.Quiz, error) {
	if quiz == nil {
		return nil, fmt.Errorf("quiz is nil")
	}
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	var reviewDateArg any
	if quiz.SourceReviewDate != nil {
		reviewDateArg = quiz.SourceReviewDate.Format("2006-01-02")
	}
	res, err := tx.ExecContext(ctx, `
		INSERT INTO quizzes(quiz_type, title, status, source_kind, source_unit_id, source_review_date)
		VALUES (?, ?, ?, ?, ?, ?)
	`, quiz.QuizType, quiz.Title, quiz.Status, quiz.SourceKind, quiz.SourceUnitID, reviewDateArg)
	if err != nil {
		return nil, err
	}
	quizID, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}

	for i, wordID := range wordIDs {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO quiz_words(quiz_id, word_id, order_no, status)
			VALUES(?, ?, ?, '未测试')
		`, quizID, wordID, i+1); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return r.GetByID(ctx, quizID)
}

func (r *QuizRepository) GetByID(ctx context.Context, quizID int64) (*entity.Quiz, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, quiz_type, title, status, source_kind, source_unit_id, source_review_date, created_at, updated_at
		FROM quizzes
		WHERE id = ?
		LIMIT 1
	`, quizID)
	item, err := scanQuiz(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *QuizRepository) List(ctx context.Context, limit, offset int) ([]QuizListRow, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	var total int64
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(1) FROM quizzes`).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT
			q.id, q.quiz_type, q.title, q.status, q.source_kind, q.source_unit_id, q.source_review_date, q.created_at, q.updated_at,
			COALESCE(stat.total_words, 0) AS total_words,
			COALESCE(stat.tested_words, 0) AS tested_words,
			COALESCE(stat.correct_count, 0) AS correct_count,
			COALESCE(stat.wrong_count, 0) AS wrong_count,
			COALESCE(stat.forgotten_count, 0) AS forgotten_count
		FROM quizzes q
		LEFT JOIN (
			SELECT
				quiz_id,
				COUNT(1) AS total_words,
				SUM(CASE WHEN status = '已测试' THEN 1 ELSE 0 END) AS tested_words,
				SUM(CASE WHEN result = '正确' THEN 1 ELSE 0 END) AS correct_count,
				SUM(CASE WHEN result = '错误' THEN 1 ELSE 0 END) AS wrong_count,
				SUM(CASE WHEN result = '忘记' THEN 1 ELSE 0 END) AS forgotten_count
			FROM quiz_words
			GROUP BY quiz_id
		) stat ON stat.quiz_id = q.id
		ORDER BY q.created_at DESC, q.id DESC
		LIMIT ? OFFSET ?
	`, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	ret := make([]QuizListRow, 0, limit)
	for rows.Next() {
		var item QuizListRow
		quiz, scanErr := scanQuizWithStats(rows, &item.TotalWords, &item.TestedWords, &item.CorrectCount, &item.WrongCount, &item.ForgottenCount)
		if scanErr != nil {
			return nil, 0, scanErr
		}
		item.Quiz = quiz
		ret = append(ret, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return ret, total, nil
}

func (r *QuizRepository) HasRunning(ctx context.Context) (bool, error) {
	var value int
	err := r.db.QueryRowContext(ctx, `
		SELECT 1
		FROM quizzes
		WHERE status = '进行中'
		LIMIT 1
	`).Scan(&value)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (r *QuizRepository) ListWords(ctx context.Context, quizID int64) ([]entity.QuizWord, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, quiz_id, word_id, order_no, status, input_answer, result, created_at, updated_at
		FROM quiz_words
		WHERE quiz_id = ?
		ORDER BY order_no ASC
	`, quizID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ret := make([]entity.QuizWord, 0)
	for rows.Next() {
		item := entity.QuizWord{}
		if err := rows.Scan(
			&item.ID,
			&item.QuizID,
			&item.WordID,
			&item.OrderNo,
			&item.Status,
			&item.InputAnswer,
			&item.Result,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		ret = append(ret, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return ret, nil
}

func (r *QuizRepository) UpdateWordResult(
	ctx context.Context,
	quizID int64,
	orderNo int,
	inputAnswer string,
	result string,
) error {
	res, err := r.db.ExecContext(ctx, `
		UPDATE quiz_words
		SET status = '已测试', input_answer = ?, result = ?
		WHERE quiz_id = ? AND order_no = ?
	`, inputAnswer, result, quizID, orderNo)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected <= 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *QuizRepository) Finish(ctx context.Context, quizID int64) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE quizzes
		SET status = '已完结'
		WHERE id = ?
	`, quizID)
	return err
}

type quizScanner interface {
	Scan(dest ...any) error
}

func scanQuiz(s quizScanner) (entity.Quiz, error) {
	item := entity.Quiz{}
	var reviewDate sql.NullTime
	if err := s.Scan(
		&item.ID,
		&item.QuizType,
		&item.Title,
		&item.Status,
		&item.SourceKind,
		&item.SourceUnitID,
		&reviewDate,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return entity.Quiz{}, err
	}
	if reviewDate.Valid {
		t := time.Date(reviewDate.Time.Year(), reviewDate.Time.Month(), reviewDate.Time.Day(), 0, 0, 0, 0, time.Local)
		item.SourceReviewDate = &t
	}
	return item, nil
}

func scanQuizWithStats(s quizScanner, statsDest ...any) (entity.Quiz, error) {
	item := entity.Quiz{}
	var reviewDate sql.NullTime
	dests := []any{
		&item.ID,
		&item.QuizType,
		&item.Title,
		&item.Status,
		&item.SourceKind,
		&item.SourceUnitID,
		&reviewDate,
		&item.CreatedAt,
		&item.UpdatedAt,
	}
	dests = append(dests, statsDest...)
	if err := s.Scan(dests...); err != nil {
		return entity.Quiz{}, err
	}
	if reviewDate.Valid {
		t := time.Date(reviewDate.Time.Year(), reviewDate.Time.Month(), reviewDate.Time.Day(), 0, 0, 0, 0, time.Local)
		item.SourceReviewDate = &t
	}
	return item, nil
}
