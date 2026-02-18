package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/wutianfang/moss/infra/recite/entity"
	"github.com/wutianfang/moss/util"
)

type WordRepository struct {
	db *sql.DB
}

func NewWordRepository(db *sql.DB) *WordRepository {
	return &WordRepository{db: db}
}

func (r *WordRepository) GetByWord(ctx context.Context, word string) (*entity.Word, error) {
	start := time.Now()
	row := r.db.QueryRowContext(ctx, `
		SELECT id, word, ph_en, ph_am, mean_tag, parts_json, sentences_json, created_at, updated_at
		FROM words WHERE word = ? LIMIT 1`, word)

	raw, err := scanWordRaw(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		util.ErrorfWithRequest(ctx, "repo.word.scan_word.scan_failed", "self_ms=%d err=%v", time.Since(start).Milliseconds(), err)
		return nil, err
	}
	item, err := scanWord(ctx, raw)
	if err != nil {
		return nil, err
	}
	return item, nil
}

func (r *WordRepository) GetByIDs(ctx context.Context, ids []int64) (map[int64]*entity.Word, error) {
	ret := make(map[int64]*entity.Word, len(ids))
	if len(ids) == 0 {
		return ret, nil
	}

	query := `SELECT id, word, ph_en, ph_am, mean_tag, parts_json, sentences_json, created_at, updated_at FROM words WHERE id IN (?`
	args := make([]any, 0, len(ids))
	args = append(args, ids[0])
	for i := 1; i < len(ids); i++ {
		query += ",?"
		args = append(args, ids[i])
	}
	query += `)`
	util.InfofWithRequest(ctx, "repo.word.get_by_ids.sql", "query=%s args=%v", query, args)

	queryStart := time.Now()
	rows, err := r.db.QueryContext(ctx, query, args...)
	queryMS := time.Since(queryStart).Milliseconds()
	if err != nil {
		util.ErrorfWithRequest(ctx, "repo.word.get_by_ids.query_failed", "query_ms=%d err=%v", queryMS, err)
		return nil, err
	}
	util.InfofWithRequest(ctx, "repo.word.get_by_ids.query_done", "query_ms=%d", queryMS)
	readStart := time.Now()
	rawRows := make([]*wordRawRow, 0, len(ids))
	for rows.Next() {
		raw, err := scanWordRaw(rows)
		if err != nil {
			_ = rows.Close()
			return nil, err
		}
		rawRows = append(rawRows, raw)
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()
		return nil, err
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}
	util.InfofWithRequest(ctx, "repo.word.get_by_ids.rows_loaded", "row_count=%d read_ms=%d", len(rawRows), time.Since(readStart).Milliseconds())

	parseStart := time.Now()
	for _, raw := range rawRows {
		item, err := scanWord(ctx, raw)
		if err != nil {
			return nil, err
		}
		ret[item.ID] = item
	}
	util.InfofWithRequest(ctx, "repo.word.get_by_ids.parse_done", "row_count=%d parse_ms=%d", len(rawRows), time.Since(parseStart).Milliseconds())

	return ret, nil
}

func (r *WordRepository) Create(ctx context.Context, word *entity.Word) error {
	partsJSON, err := json.Marshal(word.Parts)
	if err != nil {
		return fmt.Errorf("marshal parts failed: %w", err)
	}
	sentencesJSON, err := json.Marshal(word.SentenceGroups)
	if err != nil {
		return fmt.Errorf("marshal sentences failed: %w", err)
	}

	res, err := r.db.ExecContext(ctx, `
		INSERT INTO words (word, ph_en, ph_am, mean_tag, parts_json, sentences_json)
		VALUES (?, ?, ?, ?, ?, ?)
	`, word.Word, word.PhEn, word.PhAm, word.MeanTag, string(partsJSON), string(sentencesJSON))
	if err != nil {
		return err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return err
	}
	word.ID = id
	return nil
}

type scanner interface {
	Scan(dest ...any) error
}

type wordRawRow struct {
	ID            int64
	Word          string
	PhEn          string
	PhAm          string
	MeanTag       string
	PartsJSON     string
	SentencesJSON string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

func scanWordRaw(s scanner) (*wordRawRow, error) {
	raw := &wordRawRow{}
	if err := s.Scan(
		&raw.ID,
		&raw.Word,
		&raw.PhEn,
		&raw.PhAm,
		&raw.MeanTag,
		&raw.PartsJSON,
		&raw.SentencesJSON,
		&raw.CreatedAt,
		&raw.UpdatedAt,
	); err != nil {
		return nil, err
	}
	return raw, nil
}

func scanWord(ctx context.Context, raw *wordRawRow) (*entity.Word, error) {
	start := time.Now()
	item := &entity.Word{}
	if raw == nil {
		util.ErrorfWithRequest(ctx, "repo.word.scan_word.scan_failed", "self_ms=%d err=%v", time.Since(start).Milliseconds(), "raw row is nil")
		return nil, fmt.Errorf("raw row is nil")
	}
	item.ID = raw.ID
	item.Word = raw.Word
	item.PhEn = raw.PhEn
	item.PhAm = raw.PhAm
	item.MeanTag = raw.MeanTag
	item.CreatedAt = raw.CreatedAt
	item.UpdatedAt = raw.UpdatedAt

	if raw.PartsJSON != "" {
		if err := json.Unmarshal([]byte(raw.PartsJSON), &item.Parts); err != nil {
			util.ErrorfWithRequest(ctx, "repo.word.scan_word.parts_unmarshal_failed", "self_ms=%d word=%s err=%v", time.Since(start).Milliseconds(), item.Word, err)
			return nil, fmt.Errorf("unmarshal parts failed: %w", err)
		}
	}
	if raw.SentencesJSON != "" {
		if err := json.Unmarshal([]byte(raw.SentencesJSON), &item.SentenceGroups); err != nil {
			util.ErrorfWithRequest(ctx, "repo.word.scan_word.sentences_unmarshal_failed", "self_ms=%d word=%s err=%v", time.Since(start).Milliseconds(), item.Word, err)
			return nil, fmt.Errorf("unmarshal sentence groups failed: %w", err)
		}
	}
	if item.Parts == nil {
		item.Parts = make([]entity.WordPart, 0)
	}
	if item.SentenceGroups == nil {
		item.SentenceGroups = make([]entity.WordSentenceGroup, 0)
	}
	return item, nil
}
