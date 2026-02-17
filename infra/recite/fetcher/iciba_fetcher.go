package fetcher

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	htmllib "html"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/wutianfang/moss/infra/recite/entity"
)

type WordFetcher interface {
	FetchAndStore(ctx context.Context, word string) (*entity.Word, error)
	EnsureAudioFiles(ctx context.Context, word string) error
}

type IcibaFetcher struct {
	wordMP3Dir string
	client     *http.Client
}

func NewIcibaFetcher(wordMP3Dir string) *IcibaFetcher {
	return &IcibaFetcher{
		wordMP3Dir: wordMP3Dir,
		client: &http.Client{
			Timeout: 8 * time.Second,
		},
	}
}

func (f *IcibaFetcher) FetchAndStore(ctx context.Context, rawWord string) (*entity.Word, error) {
	word := strings.ToLower(strings.TrimSpace(rawWord))
	if word == "" {
		return nil, errors.New("empty word")
	}

	parsed, err := f.fetchFromIciba(ctx, word)
	if err != nil {
		return nil, err
	}

	prefix := buildPrefix(word)

	if parsed.PhEnMP3 != "" {
		enLocal := filepath.Join(f.wordMP3Dir, "en", prefix, word+".mp3")
		_ = downloadToFile(ctx, f.client, parsed.PhEnMP3, enLocal)
	}
	if parsed.PhAmMP3 != "" {
		amLocal := filepath.Join(f.wordMP3Dir, "am", prefix, word+".mp3")
		_ = downloadToFile(ctx, f.client, parsed.PhAmMP3, amLocal)
	}

	return &entity.Word{
		Word:           word,
		PhEn:           parsed.PhEn,
		PhAm:           parsed.PhAm,
		MeanTag:        parsed.MeanTag,
		Parts:          parsed.Parts,
		SentenceGroups: parsed.SentenceGroups,
	}, nil
}

func (f *IcibaFetcher) EnsureAudioFiles(ctx context.Context, rawWord string) error {
	word := strings.ToLower(strings.TrimSpace(rawWord))
	if word == "" {
		return errors.New("empty word")
	}

	enPath, amPath := f.audioLocalPaths(word)
	enReady := fileExists(enPath)
	amReady := fileExists(amPath)
	if enReady && amReady {
		return nil
	}

	parsed, err := f.fetchFromIciba(ctx, word)
	if err != nil {
		return err
	}
	if !enReady && parsed.PhEnMP3 != "" {
		if err := downloadToFile(ctx, f.client, parsed.PhEnMP3, enPath); err != nil {
			// keep best-effort behavior, retry path can still recover the other file.
		}
	}
	if !amReady && parsed.PhAmMP3 != "" {
		if err := downloadToFile(ctx, f.client, parsed.PhAmMP3, amPath); err != nil {
			// keep best-effort behavior, retry path can still recover the other file.
		}
	}

	if fileExists(enPath) && fileExists(amPath) {
		return nil
	}
	return errors.New("audio file still missing")
}

type icibaResult struct {
	PhEn           string
	PhAm           string
	PhEnMP3        string
	PhAmMP3        string
	MeanTag        string
	Parts          []entity.WordPart
	SentenceGroups []entity.WordSentenceGroup
}

func (f *IcibaFetcher) fetchFromIciba(ctx context.Context, word string) (*icibaResult, error) {
	reqURL := "https://www.iciba.com/word?w=" + url.QueryEscape(word)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36")

	resp, err := f.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("iciba status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	meanTag := extractMeanTagFromHTML(string(body))

	re := regexp.MustCompile(`(?si)<script\b[^>]*?\bid\s*=\s*["']__NEXT_DATA__["'][^>]*?>(.*?)</script>`)
	matches := re.FindStringSubmatch(string(body))
	if len(matches) < 2 {
		return nil, errors.New("cannot find iciba data")
	}

	payload := icibaNextData{}
	if err := json.Unmarshal([]byte(matches[1]), &payload); err != nil {
		return nil, err
	}

	info := payload.Props.PageProps.InitialReduxState.Word.WordInfo
	if len(info.BaesInfo.Symbols) == 0 {
		return nil, errors.New("word not found")
	}

	symbol := info.BaesInfo.Symbols[0]
	if symbol.PhAmMP3 == "" {
		symbol.PhAmMP3 = symbol.PhTtsMP3
	}
	if symbol.PhEnMP3 == "" {
		symbol.PhEnMP3 = symbol.PhTtsMP3
	}

	result := &icibaResult{
		PhEn:           symbol.PhEn,
		PhAm:           symbol.PhAm,
		PhEnMP3:        symbol.PhEnMP3,
		PhAmMP3:        symbol.PhAmMP3,
		MeanTag:        meanTag,
		Parts:          make([]entity.WordPart, 0),
		SentenceGroups: make([]entity.WordSentenceGroup, 0),
	}

	for _, item := range symbol.Parts {
		result.Parts = append(result.Parts, entity.WordPart{
			Part:  item.Part,
			Means: item.Means,
		})
	}

	for _, group := range info.NewSentence {
		sentences := make([]entity.WordSentence, 0, len(group.Sentences))
		for _, sentence := range group.Sentences {
			sentences = append(sentences, entity.WordSentence{
				ID:      sentence.ID,
				Type:    sentence.Type,
				CN:      sentence.Cn,
				EN:      sentence.En,
				From:    sentence.From,
				TTSURL:  sentence.TtsURL,
				TTSSize: sentence.TtsSize,
				LikeNum: sentence.LikeNum,
			})
		}
		result.SentenceGroups = append(result.SentenceGroups, entity.WordSentenceGroup{
			Tag:       group.Tag,
			Word:      group.Word,
			Meaning:   group.Meaning,
			Sentences: sentences,
		})
	}

	if result.PhEn == "" && result.PhAm == "" && len(result.Parts) == 0 {
		return nil, errors.New("word content empty")
	}
	return result, nil
}

func extractMeanTagFromHTML(rawHTML string) string {
	re := regexp.MustCompile(`(?s)<p class="Mean_tag[^"]*">(.*?)</p>`)
	matched := re.FindStringSubmatch(rawHTML)
	if len(matched) < 2 {
		return ""
	}
	return strings.TrimSpace(htmllib.UnescapeString(matched[1]))
}

func buildPrefix(word string) string {
	runes := []rune(word)
	if len(runes) < 2 {
		return word
	}
	return string(runes[:2])
}

func (f *IcibaFetcher) audioLocalPaths(word string) (string, string) {
	prefix := buildPrefix(word)
	enLocal := filepath.Join(f.wordMP3Dir, "en", prefix, word+".mp3")
	amLocal := filepath.Join(f.wordMP3Dir, "am", prefix, word+".mp3")
	return enLocal, amLocal
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	if info.IsDir() {
		return false
	}
	return info.Size() > 0
}

func downloadToFile(ctx context.Context, client *http.Client, source, target string) error {
	if source == "" {
		return errors.New("empty source")
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, source, nil)
	if err != nil {
		return err
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download failed, status=%d", resp.StatusCode)
	}

	tmp := target + ".tmp"
	file, err := os.Create(tmp)
	if err != nil {
		return err
	}
	if _, err := io.Copy(file, resp.Body); err != nil {
		_ = file.Close()
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	return os.Rename(tmp, target)
}

type icibaNextData struct {
	Props struct {
		PageProps struct {
			InitialReduxState struct {
				Word struct {
					WordInfo struct {
						BaesInfo struct {
							Symbols []struct {
								PhEn     string `json:"ph_en"`
								PhAm     string `json:"ph_am"`
								PhEnMP3  string `json:"ph_en_mp3"`
								PhAmMP3  string `json:"ph_am_mp3"`
								PhTtsMP3 string `json:"ph_tts_mp3"`
								Parts    []struct {
									Part  string   `json:"part"`
									Means []string `json:"means"`
								} `json:"parts"`
							} `json:"symbols"`
						} `json:"baesInfo"`
						NewSentence []struct {
							Tag       string `json:"tag"`
							Word      string `json:"word"`
							Meaning   string `json:"meaning"`
							Sentences []struct {
								ID      int    `json:"id"`
								Type    int    `json:"type"`
								Cn      string `json:"cn"`
								En      string `json:"en"`
								From    string `json:"from"`
								TtsURL  string `json:"ttsUrl"`
								TtsSize int    `json:"ttsSize"`
								LikeNum int    `json:"likeNum"`
							} `json:"sentences"`
						} `json:"new_sentence"`
					} `json:"wordInfo"`
				} `json:"word"`
			} `json:"initialReduxState"`
		} `json:"pageProps"`
	} `json:"props"`
}
