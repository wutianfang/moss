package util

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"time"
)

func InitLogger(logDir string) error {
	if err := os.MkdirAll(logDir, 0o755); err != nil {
		return fmt.Errorf("mkdir log dir failed: %w", err)
	}
	logFileName := filepath.Join(logDir, time.Now().Format("20060102")+".log")
	file, err := os.OpenFile(logFileName, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return fmt.Errorf("open log file failed: %w", err)
	}
	log.SetOutput(io.MultiWriter(os.Stdout, file))
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	return nil
}

func Infof(format string, args ...any) {
	log.Printf("[INFO] "+format, args...)
}

func Errorf(format string, args ...any) {
	log.Printf("[ERROR] "+format, args...)
}

func Fatalf(format string, args ...any) {
	log.Fatalf("[FATAL] "+format, args...)
}
