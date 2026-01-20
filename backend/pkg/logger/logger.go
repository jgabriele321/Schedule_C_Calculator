// Package logger provides structured logging for the Schedule C Calculator.
// It supports log levels and can output in JSON format for production use.
package logger

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"runtime"
	"strings"
	"sync"
	"time"
)

// Level represents a log level
type Level int

const (
	// DEBUG level for detailed debugging information
	DEBUG Level = iota
	// INFO level for general operational information
	INFO
	// WARN level for warning messages
	WARN
	// ERROR level for error messages
	ERROR
	// FATAL level for fatal errors (will exit)
	FATAL
)

// String returns the string representation of a log level
func (l Level) String() string {
	switch l {
	case DEBUG:
		return "DEBUG"
	case INFO:
		return "INFO"
	case WARN:
		return "WARN"
	case ERROR:
		return "ERROR"
	case FATAL:
		return "FATAL"
	default:
		return "UNKNOWN"
	}
}

// ParseLevel parses a string into a Level
func ParseLevel(s string) Level {
	switch strings.ToUpper(s) {
	case "DEBUG":
		return DEBUG
	case "INFO":
		return INFO
	case "WARN", "WARNING":
		return WARN
	case "ERROR":
		return ERROR
	case "FATAL":
		return FATAL
	default:
		return INFO
	}
}

// Logger is a structured logger
type Logger struct {
	mu       sync.Mutex
	level    Level
	output   io.Writer
	jsonMode bool
}

// LogEntry represents a single log entry
type LogEntry struct {
	Timestamp string                 `json:"timestamp"`
	Level     string                 `json:"level"`
	Message   string                 `json:"message"`
	Fields    map[string]interface{} `json:"fields,omitempty"`
	Caller    string                 `json:"caller,omitempty"`
}

// Default logger instance
var defaultLogger = New(INFO, os.Stdout, false)

// New creates a new logger
func New(level Level, output io.Writer, jsonMode bool) *Logger {
	return &Logger{
		level:    level,
		output:   output,
		jsonMode: jsonMode,
	}
}

// SetLevel sets the log level
func (l *Logger) SetLevel(level Level) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.level = level
}

// SetJSONMode enables or disables JSON output
func (l *Logger) SetJSONMode(jsonMode bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.jsonMode = jsonMode
}

// log writes a log entry
func (l *Logger) log(level Level, msg string, fields map[string]interface{}) {
	if level < l.level {
		return
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	// Get caller information
	_, file, line, ok := runtime.Caller(2)
	caller := ""
	if ok {
		// Get just the filename, not the full path
		parts := strings.Split(file, "/")
		if len(parts) > 0 {
			caller = fmt.Sprintf("%s:%d", parts[len(parts)-1], line)
		}
	}

	timestamp := time.Now().UTC().Format(time.RFC3339)

	if l.jsonMode {
		entry := LogEntry{
			Timestamp: timestamp,
			Level:     level.String(),
			Message:   msg,
			Fields:    fields,
			Caller:    caller,
		}
		jsonBytes, _ := json.Marshal(entry)
		fmt.Fprintln(l.output, string(jsonBytes))
	} else {
		// Human-readable format
		var fieldStr string
		if len(fields) > 0 {
			pairs := make([]string, 0, len(fields))
			for k, v := range fields {
				pairs = append(pairs, fmt.Sprintf("%s=%v", k, v))
			}
			fieldStr = " " + strings.Join(pairs, " ")
		}
		fmt.Fprintf(l.output, "%s [%s] %s%s\n", timestamp, level.String(), msg, fieldStr)
	}
}

// Debug logs a debug message
func (l *Logger) Debug(msg string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	l.log(DEBUG, msg, f)
}

// Info logs an info message
func (l *Logger) Info(msg string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	l.log(INFO, msg, f)
}

// Warn logs a warning message
func (l *Logger) Warn(msg string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	l.log(WARN, msg, f)
}

// Error logs an error message
func (l *Logger) Error(msg string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	l.log(ERROR, msg, f)
}

// Fatal logs a fatal message and exits
func (l *Logger) Fatal(msg string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	l.log(FATAL, msg, f)
	os.Exit(1)
}

// WithField creates a log entry with a single field
func (l *Logger) WithField(key string, value interface{}) *Entry {
	return &Entry{
		logger: l,
		fields: map[string]interface{}{key: value},
	}
}

// WithFields creates a log entry with multiple fields
func (l *Logger) WithFields(fields map[string]interface{}) *Entry {
	return &Entry{
		logger: l,
		fields: fields,
	}
}

// Entry represents a log entry with fields
type Entry struct {
	logger *Logger
	fields map[string]interface{}
}

// Debug logs a debug message with fields
func (e *Entry) Debug(msg string) {
	e.logger.log(DEBUG, msg, e.fields)
}

// Info logs an info message with fields
func (e *Entry) Info(msg string) {
	e.logger.log(INFO, msg, e.fields)
}

// Warn logs a warning message with fields
func (e *Entry) Warn(msg string) {
	e.logger.log(WARN, msg, e.fields)
}

// Error logs an error message with fields
func (e *Entry) Error(msg string) {
	e.logger.log(ERROR, msg, e.fields)
}

// Package-level functions using default logger

// SetLevel sets the default logger level
func SetLevel(level Level) {
	defaultLogger.SetLevel(level)
}

// SetJSONMode sets the default logger JSON mode
func SetJSONMode(jsonMode bool) {
	defaultLogger.SetJSONMode(jsonMode)
}

// Debug logs a debug message
func Debug(msg string, fields ...map[string]interface{}) {
	defaultLogger.Debug(msg, fields...)
}

// Info logs an info message
func Info(msg string, fields ...map[string]interface{}) {
	defaultLogger.Info(msg, fields...)
}

// Warn logs a warning message
func Warn(msg string, fields ...map[string]interface{}) {
	defaultLogger.Warn(msg, fields...)
}

// Error logs an error message
func Error(msg string, fields ...map[string]interface{}) {
	defaultLogger.Error(msg, fields...)
}

// Fatal logs a fatal message and exits
func Fatal(msg string, fields ...map[string]interface{}) {
	defaultLogger.Fatal(msg, fields...)
}

// WithField creates an entry with a single field
func WithField(key string, value interface{}) *Entry {
	return defaultLogger.WithField(key, value)
}

// WithFields creates an entry with multiple fields
func WithFields(fields map[string]interface{}) *Entry {
	return defaultLogger.WithFields(fields)
}

// Init initializes the logger based on environment variables
func Init() {
	levelStr := os.Getenv("LOG_LEVEL")
	if levelStr != "" {
		SetLevel(ParseLevel(levelStr))
	}

	jsonMode := os.Getenv("LOG_FORMAT") == "json"
	SetJSONMode(jsonMode)
}
