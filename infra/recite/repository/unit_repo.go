package repository

import (
	"context"
	"database/sql"

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
		SELECT id, name, created_at, updated_at
		FROM recite_units
		ORDER BY id DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ret := make([]entity.ReciteUnit, 0)
	for rows.Next() {
		item := entity.ReciteUnit{}
		if err := rows.Scan(&item.ID, &item.Name, &item.CreatedAt, &item.UpdatedAt); err != nil {
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
		SELECT id, name, created_at, updated_at
		FROM recite_units WHERE id = ? LIMIT 1
	`, id)
	item := &entity.ReciteUnit{}
	if err := row.Scan(&item.ID, &item.Name, &item.CreatedAt, &item.UpdatedAt); err == sql.ErrNoRows {
		return nil, nil
	} else if err != nil {
		return nil, err
	}
	return item, nil
}

func (r *UnitRepository) Create(ctx context.Context, name string) (*entity.ReciteUnit, error) {
	res, err := r.db.ExecContext(ctx, `INSERT INTO recite_units(name) VALUES(?)`, name)
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
