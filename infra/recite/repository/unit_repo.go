package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

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
		SELECT id, name, recite_date, sort_order, created_at, updated_at
		FROM recite_units
		ORDER BY sort_order DESC, id DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ret := make([]entity.ReciteUnit, 0)
	for rows.Next() {
		item, err := scanReciteUnit(rows)
		if err != nil {
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
		SELECT id, name, recite_date, sort_order, created_at, updated_at
		FROM recite_units WHERE id = ? LIMIT 1
	`, id)
	item, err := scanReciteUnit(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *UnitRepository) Create(ctx context.Context, name string, reciteDate *time.Time) (*entity.ReciteUnit, error) {
	var maxSort sql.NullInt64
	if err := r.db.QueryRowContext(ctx, `SELECT COALESCE(MAX(sort_order), 0) FROM recite_units`).Scan(&maxSort); err != nil {
		return nil, err
	}
	nextSort := int64(1)
	if maxSort.Valid {
		nextSort = maxSort.Int64 + 1
	}
	var reciteDateArg any
	if reciteDate != nil {
		reciteDateArg = reciteDate.Format("2006-01-02")
	}
	res, err := r.db.ExecContext(ctx, `INSERT INTO recite_units(name, recite_date, sort_order) VALUES(?, ?, ?)`, name, reciteDateArg, nextSort)
	if err != nil {
		return nil, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, id)
}

func (r *UnitRepository) Rename(ctx context.Context, id int64, name string, reciteDate *time.Time) error {
	var reciteDateArg any
	if reciteDate != nil {
		reciteDateArg = reciteDate.Format("2006-01-02")
	}
	_, err := r.db.ExecContext(ctx, `UPDATE recite_units SET name = ?, recite_date = ? WHERE id = ?`, name, reciteDateArg, id)
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

func (r *UnitRepository) Delete(ctx context.Context, id int64) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if _, err := tx.ExecContext(ctx, `DELETE FROM recite_unit_words WHERE unit_id = ?`, id); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM recite_units WHERE id = ?`, id); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *UnitRepository) ListReviewByDate(ctx context.Context, targetDate time.Time, intervals []int) ([]entity.ReciteUnit, error) {
	if len(intervals) == 0 {
		return []entity.ReciteUnit{}, nil
	}

	placeholders := strings.TrimRight(strings.Repeat("?,", len(intervals)), ",")
	args := make([]any, 0, len(intervals)+1)
	args = append(args, targetDate.Format("2006-01-02"))
	for _, d := range intervals {
		args = append(args, d)
	}

	query := fmt.Sprintf(`
		SELECT id, name, recite_date, sort_order, created_at, updated_at
		FROM recite_units
		WHERE recite_date IS NOT NULL
		  AND DATEDIFF(?, recite_date) IN (%s)
		ORDER BY sort_order DESC, id DESC
	`, placeholders)
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ret := make([]entity.ReciteUnit, 0)
	for rows.Next() {
		item, scanErr := scanReciteUnit(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		ret = append(ret, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return ret, nil
}

type reciteUnitScanner interface {
	Scan(dest ...any) error
}

func scanReciteUnit(scanner reciteUnitScanner) (entity.ReciteUnit, error) {
	item := entity.ReciteUnit{}
	var reciteDate sql.NullTime
	if err := scanner.Scan(&item.ID, &item.Name, &reciteDate, &item.SortOrder, &item.CreatedAt, &item.UpdatedAt); err != nil {
		return entity.ReciteUnit{}, err
	}
	if reciteDate.Valid {
		t := reciteDate.Time
		item.ReciteDate = &t
	}
	return item, nil
}
