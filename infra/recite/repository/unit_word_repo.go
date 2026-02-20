package repository

import (
	"context"
	"database/sql"
	"strings"

	"github.com/wutianfang/moss/infra/recite/entity"
)

type UnitWordRepository struct {
	db *sql.DB
}

func NewUnitWordRepository(db *sql.DB) *UnitWordRepository {
	return &UnitWordRepository{db: db}
}

func (r *UnitWordRepository) Add(ctx context.Context, unitID, wordID int64) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO recite_unit_words(unit_id, word_id)
		VALUES (?, ?)
		ON DUPLICATE KEY UPDATE id = id
	`, unitID, wordID)
	return err
}

func (r *UnitWordRepository) ListByUnitID(ctx context.Context, unitID int64) ([]entity.UnitWordRelation, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, unit_id, word_id, created_at
		FROM recite_unit_words
		WHERE unit_id = ?
		ORDER BY created_at DESC, id DESC
	`, unitID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ret := make([]entity.UnitWordRelation, 0)
	for rows.Next() {
		item := entity.UnitWordRelation{}
		if err := rows.Scan(&item.ID, &item.UnitID, &item.WordID, &item.CreatedAt); err != nil {
			return nil, err
		}
		ret = append(ret, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return ret, nil
}

func (r *UnitWordRepository) ListByUnitIDs(ctx context.Context, unitIDs []int64) ([]entity.UnitWordRelation, error) {
	if len(unitIDs) == 0 {
		return []entity.UnitWordRelation{}, nil
	}

	placeholders := strings.TrimRight(strings.Repeat("?,", len(unitIDs)), ",")
	args := make([]any, 0, len(unitIDs))
	for _, id := range unitIDs {
		args = append(args, id)
	}

	query := `
		SELECT id, unit_id, word_id, created_at
		FROM recite_unit_words
		WHERE unit_id IN (` + placeholders + `)
		ORDER BY created_at DESC, id DESC
	`
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ret := make([]entity.UnitWordRelation, 0)
	for rows.Next() {
		item := entity.UnitWordRelation{}
		if err := rows.Scan(&item.ID, &item.UnitID, &item.WordID, &item.CreatedAt); err != nil {
			return nil, err
		}
		ret = append(ret, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return ret, nil
}
