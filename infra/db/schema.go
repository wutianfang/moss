package db

import (
	"database/sql"
	"fmt"
	"strings"
)

var ddlList = []string{
	`CREATE TABLE IF NOT EXISTS words (
		id BIGINT PRIMARY KEY AUTO_INCREMENT,
		word VARCHAR(128) NOT NULL,
		ph_en VARCHAR(255) NOT NULL DEFAULT '',
		ph_am VARCHAR(255) NOT NULL DEFAULT '',
		mean_tag VARCHAR(255) NOT NULL DEFAULT '',
		parts_json LONGTEXT NOT NULL,
		sentences_json LONGTEXT NOT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		UNIQUE KEY uq_word(word)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
	`CREATE TABLE IF NOT EXISTS recite_units (
		id BIGINT PRIMARY KEY AUTO_INCREMENT,
		name VARCHAR(255) NOT NULL,
		recite_date DATE NULL DEFAULT NULL,
		sort_order BIGINT NOT NULL DEFAULT 0,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		KEY idx_sort_order(sort_order, id)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
	`CREATE TABLE IF NOT EXISTS recite_unit_words (
		id BIGINT PRIMARY KEY AUTO_INCREMENT,
		unit_id BIGINT NOT NULL,
		word_id BIGINT NOT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		UNIQUE KEY uq_unit_word(unit_id, word_id),
		KEY idx_unit_created(unit_id, created_at, id),
		CONSTRAINT fk_unit_word_unit FOREIGN KEY (unit_id) REFERENCES recite_units(id),
		CONSTRAINT fk_unit_word_word FOREIGN KEY (word_id) REFERENCES words(id)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
	`CREATE TABLE IF NOT EXISTS forgotten_words (
		word VARCHAR(128) NOT NULL,
		remembered TINYINT NOT NULL DEFAULT 0,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		KEY idx_word(word),
		KEY idx_remembered(remembered)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
}

func AutoMigrate(db *sql.DB) error {
	for _, ddl := range ddlList {
		if _, err := db.Exec(ddl); err != nil {
			return fmt.Errorf("exec ddl failed: %w", err)
		}
	}
	// Keep old tables compatible after deployment.
	if err := addColumnIfMissing(db, `ALTER TABLE words ADD COLUMN mean_tag VARCHAR(255) NOT NULL DEFAULT '' AFTER ph_am`); err != nil {
		return fmt.Errorf("add words.mean_tag failed: %w", err)
	}
	if err := addColumnIfMissing(db, `ALTER TABLE recite_units ADD COLUMN sort_order BIGINT NOT NULL DEFAULT 0 AFTER name`); err != nil {
		return fmt.Errorf("add recite_units.sort_order failed: %w", err)
	}
	if err := addColumnIfMissing(db, `ALTER TABLE recite_units ADD COLUMN recite_date DATE NULL DEFAULT NULL AFTER name`); err != nil {
		return fmt.Errorf("add recite_units.recite_date failed: %w", err)
	}
	if err := addIndexIfMissing(db, `ALTER TABLE recite_units ADD INDEX idx_sort_order(sort_order, id)`); err != nil {
		return fmt.Errorf("add recite_units.idx_sort_order failed: %w", err)
	}
	if _, err := db.Exec(`UPDATE recite_units SET sort_order = id WHERE sort_order = 0`); err != nil {
		return fmt.Errorf("fill recite_units.sort_order failed: %w", err)
	}
	if err := dropColumnIfExists(db, `ALTER TABLE words DROP COLUMN en_audio_path`); err != nil {
		return fmt.Errorf("drop words.en_audio_path failed: %w", err)
	}
	if err := dropColumnIfExists(db, `ALTER TABLE words DROP COLUMN am_audio_path`); err != nil {
		return fmt.Errorf("drop words.am_audio_path failed: %w", err)
	}
	return nil
}

func addColumnIfMissing(db *sql.DB, ddl string) error {
	_, err := db.Exec(ddl)
	if err == nil {
		return nil
	}
	if strings.Contains(strings.ToLower(err.Error()), "duplicate column name") {
		return nil
	}
	return err
}

func addIndexIfMissing(db *sql.DB, ddl string) error {
	_, err := db.Exec(ddl)
	if err == nil {
		return nil
	}
	msg := strings.ToLower(err.Error())
	if strings.Contains(msg, "duplicate key name") || strings.Contains(msg, "already exists") {
		return nil
	}
	return err
}

func dropColumnIfExists(db *sql.DB, ddl string) error {
	_, err := db.Exec(ddl)
	if err == nil {
		return nil
	}
	msg := strings.ToLower(err.Error())
	if strings.Contains(msg, "check that column/key exists") || strings.Contains(msg, "can't drop") {
		return nil
	}
	return err
}
