package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/wutianfang/moss/infra/recite/entity"
)

type UnitRepository struct {
	db *sql.DB
}

func NewUnitRepository(db *sql.DB) *UnitRepository {
	return &UnitRepository{db: db}
}

func (r *UnitRepository) List(ctx context.Context) ([]entity.ReciteUnit, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, name, sort_order, created_at, updated_at
		FROM recite_units
		ORDER BY sort_order DESC, id DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ret := make([]entity.ReciteUnit, 0)
	for rows.Next() {
		item := entity.ReciteUnit{}
		if err := rows.Scan(&item.ID, &item.Name, &item.SortOrder, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		ret = append(ret, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return ret, nil
}

func (r *UnitRepository) GetByID(ctx context.Context, id int64) (*entity.ReciteUnit, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, name, sort_order, created_at, updated_at
		FROM recite_units WHERE id = ? LIMIT 1
	`, id)
	item := &entity.ReciteUnit{}
	if err := row.Scan(&item.ID, &item.Name, &item.SortOrder, &item.CreatedAt, &item.UpdatedAt); err == sql.ErrNoRows {
		return nil, nil
	} else if err != nil {
		return nil, err
	}
	return item, nil
}

func (r *UnitRepository) Create(ctx context.Context, name string) (*entity.ReciteUnit, error) {
	var maxSort sql.NullInt64
	if err := r.db.QueryRowContext(ctx, `SELECT COALESCE(MAX(sort_order), 0) FROM recite_units`).Scan(&maxSort); err != nil {
		return nil, err
	}
	nextSort := int64(1)
	if maxSort.Valid {
		nextSort = maxSort.Int64 + 1
	}
	res, err := r.db.ExecContext(ctx, `INSERT INTO recite_units(name, sort_order) VALUES(?, ?)`, name, nextSort)
	if err != nil {
		return nil, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, id)
}

func (r *UnitRepository) Rename(ctx context.Context, id int64, name string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE recite_units SET name = ? WHERE id = ?`, name, id)
	return err
}

func (r *UnitRepository) Count(ctx context.Context) (int64, error) {
	var count int64
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(1) FROM recite_units`).Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

func (r *UnitRepository) Reorder(ctx context.Context, unitIDs []int64) error {
	if len(unitIDs) == 0 {
		return nil
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	placeholders := strings.TrimRight(strings.Repeat("?,", len(unitIDs)), ",")
	args := make([]any, 0, len(unitIDs))
	for _, id := range unitIDs {
		args = append(args, id)
	}

	query := fmt.Sprintf("SELECT COUNT(1) FROM recite_units WHERE id IN (%s)", placeholders)
	var foundCount int64
	if err := tx.QueryRowContext(ctx, query, args...).Scan(&foundCount); err != nil {
		return err
	}
	if foundCount != int64(len(unitIDs)) {
		return fmt.Errorf("unit list contains unknown id")
	}

	base := int64(len(unitIDs))
	for idx, unitID := range unitIDs {
		sortOrder := base - int64(idx)
		if _, err := tx.ExecContext(ctx,
			`UPDATE recite_units SET sort_order = ? WHERE id = ?`,
			sortOrder, unitID,
		); err != nil {
			return err
		}
	}

	return tx.Commit()
}
