package conf

import (
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server  ConfigServer  `yaml:"server"`
	MySQL   ConfigMySQL   `yaml:"mysql"`
	Storage ConfigStorage `yaml:"storage"`
	Recite  ConfigRecite  `yaml:"recite"`
	Log     ConfigLog     `yaml:"log"`
}

type ConfigServer struct {
	Addr string `yaml:"addr"`
}

type ConfigMySQL struct {
	DSN                string `yaml:"dsn"`
	MaxOpenConns       int    `yaml:"max_open_conns"`
	MaxIdleConns       int    `yaml:"max_idle_conns"`
	ConnMaxLifetimeSec int    `yaml:"conn_max_lifetime_sec"`
}

type ConfigStorage struct {
	WordMP3Dir string `yaml:"word_mp3_dir"`
}

type ConfigRecite struct {
	DefaultAccent string `yaml:"default_accent"`
}

type ConfigLog struct {
	Dir              string `yaml:"dir"`
	EnableRequestLog bool   `yaml:"enable_request_log"`
}

func Load(path string) (*Config, error) {
	cfg := defaultConfig()

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config failed: %w", err)
	}
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("parse config failed: %w", err)
	}

	fillDefault(cfg)
	return cfg, nil
}

func defaultConfig() *Config {
	cfg := &Config{}
	cfg.Server.Addr = ":1324"
	cfg.MySQL.MaxOpenConns = 10
	cfg.MySQL.MaxIdleConns = 5
	cfg.MySQL.ConnMaxLifetimeSec = 300
	cfg.Storage.WordMP3Dir = "store/word_mp3"
	cfg.Recite.DefaultAccent = "en"
	cfg.Log.Dir = "log"
	cfg.Log.EnableRequestLog = false
	return cfg
}

func fillDefault(cfg *Config) {
	if cfg.Server.Addr == "" {
		cfg.Server.Addr = ":1324"
	}
	if cfg.MySQL.MaxOpenConns <= 0 {
		cfg.MySQL.MaxOpenConns = 10
	}
	if cfg.MySQL.MaxIdleConns < 0 {
		cfg.MySQL.MaxIdleConns = 5
	}
	if cfg.MySQL.ConnMaxLifetimeSec <= 0 {
		cfg.MySQL.ConnMaxLifetimeSec = 300
	}
	if cfg.Storage.WordMP3Dir == "" {
		cfg.Storage.WordMP3Dir = "store/word_mp3"
	}
	cfg.Recite.DefaultAccent = normalizeAccent(cfg.Recite.DefaultAccent)
	if cfg.Log.Dir == "" {
		cfg.Log.Dir = "log"
	}
}

func normalizeAccent(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "am":
		return "am"
	case "en":
		return "en"
	default:
		return "en"
	}
}
