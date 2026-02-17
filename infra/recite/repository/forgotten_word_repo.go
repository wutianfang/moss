package repository

import (
	"context"
	"database/sql"
)

type ForgottenWordRepository struct {
	db *sql.DB
}

func NewForgottenWordRepository(db *sql.DB) *ForgottenWordRepository {
	return &ForgottenWordRepository{db: db}
}

func (r *ForgottenWordRepository) Add(ctx context.Context, word string) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO forgotten_words(word, remembered)
		VALUES (?, 0)
	`, word)
	return err
}

func (r *ForgottenWordRepository) ListUnrememberedDistinct(ctx context.Context) ([]string, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT word
		FROM forgotten_words
		WHERE remembered = 0
		GROUP BY word
		ORDER BY MAX(created_at) DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ret := make([]string, 0)
	for rows.Next() {
		var word string
		if err := rows.Scan(&word); err != nil {
			return nil, err
		}
		ret = append(ret, word)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return ret, nil
}

func (r *ForgottenWordRepository) MarkRememberedByWord(ctx context.Context, word string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE forgotten_words
		SET remembered = 1
		WHERE word = ?
	`, word)
	return err
}
