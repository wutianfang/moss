package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/wutianfang/moss/conf"
	"github.com/wutianfang/moss/infra/db"
)

const (
	lokiDBPath  = "/Users/bytedance/go/src/github.com/wutianfang/loki/store/loki.db"
	mossBaseURL = "http://14.103.100.153:1324/"
	configPath  = "conf/config.yaml"
)

type options struct {
	UnitIDs []int64
	Sleep   time.Duration
}

type lokiUnit struct {
	ID         int64
	Name       string
	CreateTime string
}

type lokiUnitWord struct {
	Word       string
	CreateTime string
}

type queryWordResponse struct {
	Errno int    `json:"errno"`
	Error string `json:"error"`
	Data  struct {
		Word struct {
			ID int64 `json:"id"`
		} `json:"word"`
	} `json:"data"`
}

func main() {
	opts, err := parseOptions()
	if err != nil {
		fmt.Fprintf(os.Stderr, "parse args failed: %v\n", err)
		os.Exit(2)
	}

	cfg, err := conf.Load(configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "load config failed: %v\n", err)
		os.Exit(1)
	}

	mysqlDB, err := db.InitMySQL(&cfg.MySQL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "connect mysql failed: %v\n", err)
		os.Exit(1)
	}
	defer mysqlDB.Close()

	ctx := context.Background()
	client := &http.Client{Timeout: 15 * time.Second}

	var totalWords int
	var successWords int
	var failedWords int

	fmt.Printf("start sync: unit_ids=%v sleep=%s\n", opts.UnitIDs, opts.Sleep)
	for _, sourceUnitID := range opts.UnitIDs {
		srcUnit, err := fetchLokiUnit(sourceUnitID)
		if err != nil {
			fmt.Fprintf(os.Stderr, "[unit:%d] load source unit failed: %v\n", sourceUnitID, err)
			continue
		}
		srcWords, err := fetchLokiUnitWords(sourceUnitID)
		if err != nil {
			fmt.Fprintf(os.Stderr, "[unit:%d] load source unit words failed: %v\n", sourceUnitID, err)
			continue
		}

		targetUnitID, reused, err := ensureTargetUnit(ctx, mysqlDB, srcUnit)
		if err != nil {
			fmt.Fprintf(os.Stderr, "[unit:%d] ensure target unit failed: %v\n", sourceUnitID, err)
			continue
		}

		action := "created"
		if reused {
			action = "reused"
		}
		fmt.Printf("[unit:%d] %s -> target_unit_id=%d (%s), words=%d\n",
			srcUnit.ID, srcUnit.Name, targetUnitID, action, len(srcWords))

		for idx, item := range srcWords {
			totalWords++
			wordID, err := queryWordAndGetID(ctx, client, item.Word)
			if err != nil {
				failedWords++
				fmt.Fprintf(os.Stderr, "  [%d/%d] word=%s query failed: %v\n",
					idx+1, len(srcWords), item.Word, err)
				time.Sleep(opts.Sleep)
				continue
			}

			if err := upsertUnitWordRelation(ctx, mysqlDB, targetUnitID, wordID, item.CreateTime); err != nil {
				failedWords++
				fmt.Fprintf(os.Stderr, "  [%d/%d] word=%s relation write failed: %v\n",
					idx+1, len(srcWords), item.Word, err)
			} else {
				successWords++
				fmt.Printf("  [%d/%d] word=%s synced\n", idx+1, len(srcWords), item.Word)
			}

			time.Sleep(opts.Sleep)
		}
	}

	fmt.Printf("sync done: total=%d success=%d failed=%d\n", totalWords, successWords, failedWords)
	if failedWords > 0 {
		os.Exit(1)
	}
}

func parseOptions() (*options, error) {
	var unitIDsRaw string
	var sleep time.Duration
	flag.StringVar(&unitIDsRaw, "unit-ids", "", "comma-separated source unit ids in loki db, e.g. 1,2,3")
	flag.DurationVar(&sleep, "sleep", time.Second, "sleep interval between each word query")
	flag.Parse()

	unitIDs, err := parseIDList(unitIDsRaw)
	if err != nil {
		return nil, err
	}
	if len(unitIDs) == 0 {
		return nil, errors.New("unit-ids is required")
	}

	if sleep < 0 {
		return nil, errors.New("sleep must be >= 0")
	}

	return &options{
		UnitIDs: unitIDs,
		Sleep:   sleep,
	}, nil
}

func parseIDList(raw string) ([]int64, error) {
	normalized := strings.ReplaceAll(raw, "，", ",")
	parts := strings.Split(normalized, ",")

	ret := make([]int64, 0, len(parts))
	seen := map[int64]struct{}{}
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		id, err := strconv.ParseInt(part, 10, 64)
		if err != nil || id <= 0 {
			return nil, fmt.Errorf("invalid unit id: %q", part)
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ret = append(ret, id)
	}
	return ret, nil
}

func fetchLokiUnit(id int64) (*lokiUnit, error) {
	query := fmt.Sprintf(
		"SELECT id, COALESCE(name,''), COALESCE(create_time,'') FROM units WHERE id = %d LIMIT 1;",
		id,
	)
	rows, err := querySQLite(query, 3)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("unit not found: %d", id)
	}
	unitID, err := strconv.ParseInt(strings.TrimSpace(rows[0][0]), 10, 64)
	if err != nil {
		return nil, fmt.Errorf("parse unit id failed: %w", err)
	}
	name := strings.TrimSpace(rows[0][1])
	if name == "" {
		return nil, fmt.Errorf("unit name empty: %d", id)
	}
	return &lokiUnit{
		ID:         unitID,
		Name:       name,
		CreateTime: strings.TrimSpace(rows[0][2]),
	}, nil
}

func fetchLokiUnitWords(unitID int64) ([]lokiUnitWord, error) {
	query := fmt.Sprintf(
		"SELECT COALESCE(word,''), COALESCE(create_time,'') FROM unit_word_relation WHERE unit_id = %d ORDER BY create_time ASC, id ASC;",
		unitID,
	)
	rows, err := querySQLite(query, 2)
	if err != nil {
		return nil, err
	}
	ret := make([]lokiUnitWord, 0, len(rows))
	seen := map[string]struct{}{}
	for _, row := range rows {
		word := strings.ToLower(strings.TrimSpace(row[0]))
		if word == "" {
			continue
		}
		if _, ok := seen[word]; ok {
			continue
		}
		seen[word] = struct{}{}
		ret = append(ret, lokiUnitWord{
			Word:       word,
			CreateTime: strings.TrimSpace(row[1]),
		})
	}
	return ret, nil
}

func querySQLite(query string, cols int) ([][]string, error) {
	cmd := exec.Command("sqlite3", "-separator", "\t", lokiDBPath, query)
	out, err := cmd.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return nil, fmt.Errorf("sqlite query failed: %s", strings.TrimSpace(string(exitErr.Stderr)))
		}
		return nil, fmt.Errorf("exec sqlite3 failed: %w", err)
	}

	text := strings.TrimRight(string(out), "\r\n")
	if text == "" {
		return [][]string{}, nil
	}

	lines := strings.Split(text, "\n")
	ret := make([][]string, 0, len(lines))
	for _, line := range lines {
		fields := strings.Split(line, "\t")
		if len(fields) < cols {
			for len(fields) < cols {
				fields = append(fields, "")
			}
		}
		if len(fields) > cols {
			fields = fields[:cols]
		}
		if len(fields) != cols {
			return nil, fmt.Errorf("sqlite row columns mismatch, want=%d got=%d line=%q", cols, len(fields), line)
		}
		ret = append(ret, fields)
	}
	return ret, nil
}

func ensureTargetUnit(ctx context.Context, mysqlDB *sql.DB, srcUnit *lokiUnit) (int64, bool, error) {
	var existingID int64
	err := mysqlDB.QueryRowContext(ctx,
		"SELECT id FROM recite_units WHERE name = ? ORDER BY id DESC LIMIT 1",
		srcUnit.Name,
	).Scan(&existingID)
	if err == nil {
		return existingID, true, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return 0, false, err
	}

	var maxSort sql.NullInt64
	if err := mysqlDB.QueryRowContext(ctx, `SELECT COALESCE(MAX(sort_order), 0) FROM recite_units`).Scan(&maxSort); err != nil {
		return 0, false, err
	}
	nextSort := int64(1)
	if maxSort.Valid {
		nextSort = maxSort.Int64 + 1
	}

	createAt := parseSQLiteDateTime(srcUnit.CreateTime)
	res, err := mysqlDB.ExecContext(ctx,
		"INSERT INTO recite_units(name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?)",
		srcUnit.Name, nextSort, createAt, createAt,
	)
	if err != nil {
		return 0, false, err
	}
	newID, err := res.LastInsertId()
	if err != nil {
		return 0, false, err
	}
	return newID, false, nil
}

func queryWordAndGetID(ctx context.Context, client *http.Client, word string) (int64, error) {
	payload := map[string]string{"word": word}
	body, err := json.Marshal(payload)
	if err != nil {
		return 0, err
	}

	apiURL := strings.TrimRight(mossBaseURL, "/") + "/api/recite/words/query"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(body))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, err
	}
	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("http status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}

	result := queryWordResponse{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return 0, fmt.Errorf("decode response failed: %w", err)
	}
	if result.Errno != 0 {
		return 0, fmt.Errorf("api errno=%d error=%s", result.Errno, result.Error)
	}
	if result.Data.Word.ID <= 0 {
		return 0, errors.New("api returns empty word id")
	}
	return result.Data.Word.ID, nil
}

func upsertUnitWordRelation(ctx context.Context, mysqlDB *sql.DB, unitID, wordID int64, sourceCreateTime string) error {
	createAt := parseSQLiteDateTime(sourceCreateTime)
	_, err := mysqlDB.ExecContext(ctx,
		"INSERT IGNORE INTO recite_unit_words(unit_id, word_id, created_at) VALUES (?, ?, ?)",
		unitID, wordID, createAt,
	)
	return err
}

func parseSQLiteDateTime(raw string) time.Time {
	value := strings.TrimSpace(raw)
	if value == "" {
		return time.Now()
	}
	t, err := time.ParseInLocation("2006-01-02 15:04:05", value, time.Local)
	if err != nil {
		return time.Now()
	}
	return t
}
