package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/wutianfang/moss/infra/recite/entity"
)

type WordRepository struct {
	db *sql.DB
}

func NewWordRepository(db *sql.DB) *WordRepository {
	return &WordRepository{db: db}
}

func (r *WordRepository) GetByWord(ctx context.Context, word string) (*entity.Word, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, word, ph_en, ph_am, mean_tag, parts_json, sentences_json, created_at, updated_at
		FROM words WHERE word = ? LIMIT 1`, word)

	item, err := scanWord(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
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

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		item, err := scanWord(rows)
		if err != nil {
			return nil, err
		}
		ret[item.ID] = item
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
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

func scanWord(s scanner) (*entity.Word, error) {
	item := &entity.Word{}
	var partsJSON string
	var sentencesJSON string
	if err := s.Scan(
		&item.ID,
		&item.Word,
		&item.PhEn,
		&item.PhAm,
		&item.MeanTag,
		&partsJSON,
		&sentencesJSON,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return nil, err
	}
	if partsJSON != "" {
		if err := json.Unmarshal([]byte(partsJSON), &item.Parts); err != nil {
			return nil, fmt.Errorf("unmarshal parts failed: %w", err)
		}
	}
	if sentencesJSON != "" {
		if err := json.Unmarshal([]byte(sentencesJSON), &item.SentenceGroups); err != nil {
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
