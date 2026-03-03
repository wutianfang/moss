package repository

import (
	"context"
	"database/sql"
	"strings"

	"github.com/wutianfang/moss/infra/recite/entity"
)

type NoteRepository struct {
	db *sql.DB
}

type NoteListRow struct {
	Note      entity.Note
	WordCount int
}

func NewNoteRepository(db *sql.DB) *NoteRepository {
	return &NoteRepository{db: db}
}

func (r *NoteRepository) Create(ctx context.Context, noteType, content string, wordIDs []int64) (*entity.Note, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	res, err := tx.ExecContext(ctx, `
		INSERT INTO notes(note_type, content)
		VALUES(?, ?)
	`, noteType, content)
	if err != nil {
		return nil, err
	}
	noteID, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	for _, wordID := range wordIDs {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO note_words(note_id, word_id)
			VALUES(?, ?)
		`, noteID, wordID); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return r.GetByID(ctx, noteID)
}

func (r *NoteRepository) Update(ctx context.Context, noteID int64, noteType, content string, wordIDs []int64) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if _, err := tx.ExecContext(ctx, `
		UPDATE notes
		SET note_type = ?, content = ?
		WHERE id = ?
	`, noteType, content, noteID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM note_words WHERE note_id = ?`, noteID); err != nil {
		return err
	}
	for _, wordID := range wordIDs {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO note_words(note_id, word_id)
			VALUES(?, ?)
		`, noteID, wordID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *NoteRepository) GetByID(ctx context.Context, noteID int64) (*entity.Note, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, note_type, content, created_at, updated_at
		FROM notes
		WHERE id = ?
		LIMIT 1
	`, noteID)
	item := entity.Note{}
	if err := row.Scan(&item.ID, &item.NoteType, &item.Content, &item.CreatedAt, &item.UpdatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &item, nil
}

func (r *NoteRepository) List(ctx context.Context, limit, offset int) ([]NoteListRow, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	var total int64
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(1) FROM notes`).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT n.id, n.note_type, n.content, n.created_at, n.updated_at, COALESCE(stat.word_count, 0) AS word_count
		FROM notes n
		LEFT JOIN (
			SELECT note_id, COUNT(1) AS word_count
			FROM note_words
			GROUP BY note_id
		) stat ON stat.note_id = n.id
		ORDER BY n.created_at DESC, n.id DESC
		LIMIT ? OFFSET ?
	`, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	ret := make([]NoteListRow, 0, limit)
	for rows.Next() {
		item := NoteListRow{}
		if err := rows.Scan(
			&item.Note.ID,
			&item.Note.NoteType,
			&item.Note.Content,
			&item.Note.CreatedAt,
			&item.Note.UpdatedAt,
			&item.WordCount,
		); err != nil {
			return nil, 0, err
		}
		ret = append(ret, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return ret, total, nil
}

func (r *NoteRepository) ListWordRelationsByNoteID(ctx context.Context, noteID int64) ([]entity.NoteWordRelation, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, note_id, word_id, created_at
		FROM note_words
		WHERE note_id = ?
		ORDER BY id ASC
	`, noteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ret := make([]entity.NoteWordRelation, 0)
	for rows.Next() {
		item := entity.NoteWordRelation{}
		if err := rows.Scan(&item.ID, &item.NoteID, &item.WordID, &item.CreatedAt); err != nil {
			return nil, err
		}
		ret = append(ret, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return ret, nil
}

func (r *NoteRepository) ListWordRelationsByNoteIDs(ctx context.Context, noteIDs []int64) ([]entity.NoteWordRelation, error) {
	if len(noteIDs) == 0 {
		return []entity.NoteWordRelation{}, nil
	}
	placeholders := strings.TrimRight(strings.Repeat("?,", len(noteIDs)), ",")
	args := make([]any, 0, len(noteIDs))
	for _, id := range noteIDs {
		args = append(args, id)
	}
	query := `
		SELECT id, note_id, word_id, created_at
		FROM note_words
		WHERE note_id IN (` + placeholders + `)
		ORDER BY note_id ASC, id ASC
	`
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ret := make([]entity.NoteWordRelation, 0)
	for rows.Next() {
		item := entity.NoteWordRelation{}
		if err := rows.Scan(&item.ID, &item.NoteID, &item.WordID, &item.CreatedAt); err != nil {
			return nil, err
		}
		ret = append(ret, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return ret, nil
}

func (r *NoteRepository) ListByWordIDs(ctx context.Context, wordIDs []int64) (map[int64][]entity.Note, error) {
	ret := make(map[int64][]entity.Note)
	if len(wordIDs) == 0 {
		return ret, nil
	}
	placeholders := strings.TrimRight(strings.Repeat("?,", len(wordIDs)), ",")
	args := make([]any, 0, len(wordIDs))
	for _, id := range wordIDs {
		args = append(args, id)
	}
	query := `
		SELECT nw.word_id, n.id, n.note_type
		FROM note_words nw
		JOIN notes n ON n.id = nw.note_id
		WHERE nw.word_id IN (` + placeholders + `)
		ORDER BY nw.word_id ASC, n.created_at DESC, n.id DESC
	`
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var wordID int64
		note := entity.Note{}
		if err := rows.Scan(&wordID, &note.ID, &note.NoteType); err != nil {
			return nil, err
		}
		ret[wordID] = append(ret[wordID], note)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return ret, nil
}
