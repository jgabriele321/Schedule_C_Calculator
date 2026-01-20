// Package errors provides structured error types for the Schedule C Calculator.
// These errors provide user-friendly messages while preserving technical details.
package errors

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// AppError represents an application error with user-friendly messaging
type AppError struct {
	// Code is a machine-readable error code
	Code string `json:"code"`

	// Message is a user-friendly error message
	Message string `json:"message"`

	// Details contains additional error information (optional)
	Details string `json:"details,omitempty"`

	// HTTPStatus is the HTTP status code to return
	HTTPStatus int `json:"-"`

	// Err is the underlying error (not serialized to JSON)
	Err error `json:"-"`
}

// Error implements the error interface
func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %s (%v)", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// Unwrap returns the underlying error
func (e *AppError) Unwrap() error {
	return e.Err
}

// WriteJSON writes the error as a JSON response
func (e *AppError) WriteJSON(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(e.HTTPStatus)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": false,
		"error":   e,
	})
}

// Common error codes
const (
	ErrCodeValidation     = "VALIDATION_ERROR"
	ErrCodeNotFound       = "NOT_FOUND"
	ErrCodeDatabase       = "DATABASE_ERROR"
	ErrCodeFileUpload     = "FILE_UPLOAD_ERROR"
	ErrCodeCSVParse       = "CSV_PARSE_ERROR"
	ErrCodeLLM            = "LLM_ERROR"
	ErrCodeInternal       = "INTERNAL_ERROR"
	ErrCodeUnauthorized   = "UNAUTHORIZED"
	ErrCodeRateLimit      = "RATE_LIMIT_EXCEEDED"
	ErrCodeInvalidRequest = "INVALID_REQUEST"
)

// Predefined errors for common cases

// ErrNoFileProvided is returned when no file is provided in an upload request
var ErrNoFileProvided = &AppError{
	Code:       ErrCodeFileUpload,
	Message:    "No file was provided in the upload request",
	HTTPStatus: http.StatusBadRequest,
}

// ErrInvalidFileType is returned when an unsupported file type is uploaded
var ErrInvalidFileType = &AppError{
	Code:       ErrCodeValidation,
	Message:    "Only CSV files are supported",
	HTTPStatus: http.StatusBadRequest,
}

// ErrFileTooLarge is returned when an uploaded file exceeds the size limit
func ErrFileTooLarge(maxSize int64) *AppError {
	return &AppError{
		Code:       ErrCodeFileUpload,
		Message:    fmt.Sprintf("File exceeds maximum size of %d MB", maxSize/(1024*1024)),
		HTTPStatus: http.StatusRequestEntityTooLarge,
	}
}

// ErrEmptyCSV is returned when a CSV file has no data rows
var ErrEmptyCSV = &AppError{
	Code:       ErrCodeCSVParse,
	Message:    "The CSV file is empty or contains only headers",
	HTTPStatus: http.StatusBadRequest,
}

// ErrCSVParseFailed is returned when CSV parsing fails
func ErrCSVParseFailed(err error) *AppError {
	return &AppError{
		Code:       ErrCodeCSVParse,
		Message:    "Failed to parse CSV file. Please ensure it is a valid CSV format.",
		Details:    err.Error(),
		HTTPStatus: http.StatusBadRequest,
		Err:        err,
	}
}

// ErrInvalidSourceType is returned when an invalid source type is provided
func ErrInvalidSourceType(provided string) *AppError {
	return &AppError{
		Code:       ErrCodeValidation,
		Message:    "Invalid source type. Must be one of: income, expenses, both",
		Details:    fmt.Sprintf("Provided: %s", provided),
		HTTPStatus: http.StatusBadRequest,
	}
}

// ErrDatabaseOperation is returned when a database operation fails
func ErrDatabaseOperation(operation string, err error) *AppError {
	return &AppError{
		Code:       ErrCodeDatabase,
		Message:    fmt.Sprintf("Database operation failed: %s", operation),
		HTTPStatus: http.StatusInternalServerError,
		Err:        err,
	}
}

// ErrTransactionNotFound is returned when a transaction ID doesn't exist
func ErrTransactionNotFound(id string) *AppError {
	return &AppError{
		Code:       ErrCodeNotFound,
		Message:    "Transaction not found",
		Details:    fmt.Sprintf("Transaction ID: %s", id),
		HTTPStatus: http.StatusNotFound,
	}
}

// ErrLLMRequest is returned when an LLM API request fails
func ErrLLMRequest(err error) *AppError {
	return &AppError{
		Code:       ErrCodeLLM,
		Message:    "AI categorization service is temporarily unavailable",
		HTTPStatus: http.StatusServiceUnavailable,
		Err:        err,
	}
}

// ErrInvalidJSON is returned when request body contains invalid JSON
func ErrInvalidJSON(err error) *AppError {
	return &AppError{
		Code:       ErrCodeInvalidRequest,
		Message:    "Invalid JSON in request body",
		HTTPStatus: http.StatusBadRequest,
		Err:        err,
	}
}

// ErrMissingRequiredField is returned when a required field is missing
func ErrMissingRequiredField(field string) *AppError {
	return &AppError{
		Code:       ErrCodeValidation,
		Message:    fmt.Sprintf("Required field is missing: %s", field),
		HTTPStatus: http.StatusBadRequest,
	}
}

// ErrInvalidRange is returned when a numeric value is out of valid range
func ErrInvalidRange(field string, min, max float64) *AppError {
	return &AppError{
		Code:       ErrCodeValidation,
		Message:    fmt.Sprintf("%s must be between %.0f and %.0f", field, min, max),
		HTTPStatus: http.StatusBadRequest,
	}
}

// ErrAPIKeyRequired is returned when API key is missing for LLM operations
var ErrAPIKeyRequired = &AppError{
	Code:       ErrCodeUnauthorized,
	Message:    "API key is required for AI categorization",
	HTTPStatus: http.StatusUnauthorized,
}

// PartialSuccess represents a response where some operations succeeded
type PartialSuccess struct {
	Success    bool     `json:"success"`
	Message    string   `json:"message"`
	Processed  int      `json:"processed"`
	Failed     int      `json:"failed"`
	FailedIDs  []string `json:"failed_ids,omitempty"`
	Errors     []string `json:"errors,omitempty"`
}

// NewPartialSuccess creates a new partial success response
func NewPartialSuccess(processed, failed int, failedIDs []string, errors []string) *PartialSuccess {
	return &PartialSuccess{
		Success:   failed == 0,
		Message:   fmt.Sprintf("Processed %d items successfully, %d failed", processed, failed),
		Processed: processed,
		Failed:    failed,
		FailedIDs: failedIDs,
		Errors:    errors,
	}
}
