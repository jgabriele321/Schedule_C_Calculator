// Package validation provides input validation for the Schedule C Calculator.
package validation

import (
	"fmt"
	"mime/multipart"
	"regexp"
	"strings"

	"schedccalc/pkg/config"
	"schedccalc/pkg/errors"
)

// FileUploadRequest validates file upload requests
type FileUploadRequest struct {
	File   *multipart.FileHeader
	Source string
}

// Validate validates the file upload request
func (r *FileUploadRequest) Validate(maxSize int64) *errors.AppError {
	if r.File == nil {
		return errors.ErrNoFileProvided
	}

	// Check file extension
	filename := strings.ToLower(r.File.Filename)
	if !strings.HasSuffix(filename, ".csv") {
		return errors.ErrInvalidFileType
	}

	// Check file size
	if r.File.Size > maxSize {
		return errors.ErrFileTooLarge(maxSize)
	}

	// Validate source type
	if r.Source != "" && r.Source != "income" && r.Source != "expenses" && r.Source != "both" {
		return errors.ErrInvalidSourceType(r.Source)
	}

	return nil
}

// ToggleBusinessRequest validates toggle business status requests
type ToggleBusinessRequest struct {
	TransactionID string `json:"transaction_id"`
	IsBusiness    bool   `json:"is_business"`
}

// Validate validates the toggle business request
func (r *ToggleBusinessRequest) Validate() *errors.AppError {
	if r.TransactionID == "" {
		return errors.ErrMissingRequiredField("transaction_id")
	}

	// Basic UUID format validation
	if !isValidUUID(r.TransactionID) {
		return &errors.AppError{
			Code:       errors.ErrCodeValidation,
			Message:    "Invalid transaction ID format",
			HTTPStatus: 400,
		}
	}

	return nil
}

// VehicleDeductionRequest validates vehicle deduction requests
type VehicleDeductionRequest struct {
	BusinessMiles int `json:"business_miles"`
}

// Validate validates the vehicle deduction request
func (r *VehicleDeductionRequest) Validate() *errors.AppError {
	if r.BusinessMiles < 0 {
		return errors.ErrInvalidRange("business_miles", 0, 1000000)
	}

	// Sanity check - more than 1 million miles seems unreasonable
	if r.BusinessMiles > 1000000 {
		return errors.ErrInvalidRange("business_miles", 0, 1000000)
	}

	return nil
}

// HomeOfficeDeductionRequest validates home office deduction requests
type HomeOfficeDeductionRequest struct {
	HomeOfficeSqft int  `json:"home_office_sqft"`
	TotalHomeSqft  int  `json:"total_home_sqft"`
	UseSimplified  bool `json:"use_simplified"`
}

// Validate validates the home office deduction request
func (r *HomeOfficeDeductionRequest) Validate() *errors.AppError {
	if r.HomeOfficeSqft < 0 {
		return errors.ErrInvalidRange("home_office_sqft", 0, 50000)
	}

	if r.TotalHomeSqft < 0 {
		return errors.ErrInvalidRange("total_home_sqft", 0, 100000)
	}

	// Home office can't be larger than total home
	if !r.UseSimplified && r.TotalHomeSqft > 0 && r.HomeOfficeSqft > r.TotalHomeSqft {
		return &errors.AppError{
			Code:       errors.ErrCodeValidation,
			Message:    "Home office square footage cannot exceed total home square footage",
			HTTPStatus: 400,
		}
	}

	return nil
}

// ClassifyTransactionRequest validates transaction classification requests
type ClassifyTransactionRequest struct {
	TransactionID string `json:"transaction_id"`
	Category      string `json:"category,omitempty"`
	Purpose       string `json:"purpose,omitempty"`
	Expensable    *bool  `json:"expensable,omitempty"`
	ScheduleCLine *int   `json:"schedule_c_line,omitempty"`
}

// Validate validates the classification request
func (r *ClassifyTransactionRequest) Validate() *errors.AppError {
	if r.TransactionID == "" {
		return errors.ErrMissingRequiredField("transaction_id")
	}

	// Validate Schedule C line if provided
	if r.ScheduleCLine != nil {
		if !config.IsValidScheduleCLine(*r.ScheduleCLine) && *r.ScheduleCLine != 0 {
			return &errors.AppError{
				Code:       errors.ErrCodeValidation,
				Message:    fmt.Sprintf("Invalid Schedule C line number. Must be between %d and %d, or %d", config.MinScheduleCLine, config.MaxScheduleCLine, config.HomeOfficeLine),
				HTTPStatus: 400,
			}
		}
	}

	// Sanitize category to prevent XSS
	if r.Category != "" {
		r.Category = sanitizeString(r.Category, 100)
	}

	// Sanitize purpose
	if r.Purpose != "" {
		r.Purpose = sanitizeString(r.Purpose, 500)
	}

	return nil
}

// VendorRuleRequest validates vendor rule creation requests
type VendorRuleRequest struct {
	Vendor        string `json:"vendor"`
	Type          string `json:"type"`
	Expensable    bool   `json:"expensable"`
	Category      string `json:"category"`
	ScheduleCLine int    `json:"schedule_c_line"`
}

// Validate validates the vendor rule request
func (r *VendorRuleRequest) Validate() *errors.AppError {
	if r.Vendor == "" {
		return errors.ErrMissingRequiredField("vendor")
	}

	if r.Category == "" {
		return errors.ErrMissingRequiredField("category")
	}

	// Validate type
	if r.Type != "" && r.Type != "income" && r.Type != "expense" {
		return &errors.AppError{
			Code:       errors.ErrCodeValidation,
			Message:    "Type must be 'income' or 'expense'",
			HTTPStatus: 400,
		}
	}

	// Validate Schedule C line if provided
	if r.ScheduleCLine != 0 && !config.IsValidScheduleCLine(r.ScheduleCLine) {
		return &errors.AppError{
			Code:       errors.ErrCodeValidation,
			Message:    "Invalid Schedule C line number",
			HTTPStatus: 400,
		}
	}

	// Sanitize strings
	r.Vendor = sanitizeString(r.Vendor, 100)
	r.Category = sanitizeString(r.Category, 100)

	return nil
}

// PaginationParams validates pagination parameters
type PaginationParams struct {
	Page     int
	PageSize int
}

// Validate validates and normalizes pagination parameters
func (p *PaginationParams) Validate() {
	cfg := config.DefaultPaginationConfig()

	if p.Page < 1 {
		p.Page = 1
	}

	if p.PageSize < 1 {
		p.PageSize = cfg.DefaultPageSize
	}

	if p.PageSize > cfg.MaxPageSize {
		p.PageSize = cfg.MaxPageSize
	}
}

// Helper functions

// isValidUUID checks if a string is a valid UUID format
func isValidUUID(s string) bool {
	uuidRegex := regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
	return uuidRegex.MatchString(s)
}

// sanitizeString removes potentially dangerous characters and limits length
func sanitizeString(s string, maxLen int) string {
	// Trim whitespace
	s = strings.TrimSpace(s)

	// Remove HTML tags (basic XSS prevention)
	htmlTagRegex := regexp.MustCompile(`<[^>]*>`)
	s = htmlTagRegex.ReplaceAllString(s, "")

	// Remove control characters
	controlCharRegex := regexp.MustCompile(`[\x00-\x1F\x7F]`)
	s = controlCharRegex.ReplaceAllString(s, "")

	// Limit length
	if len(s) > maxLen {
		s = s[:maxLen]
	}

	return s
}

// SanitizeFilename removes potentially dangerous characters from filenames
func SanitizeFilename(filename string) string {
	// Remove path separators
	filename = strings.ReplaceAll(filename, "/", "_")
	filename = strings.ReplaceAll(filename, "\\", "_")

	// Remove other dangerous characters
	dangerousChars := regexp.MustCompile(`[<>:"|?*\x00-\x1F]`)
	filename = dangerousChars.ReplaceAllString(filename, "_")

	// Limit length
	if len(filename) > 255 {
		ext := ""
		if idx := strings.LastIndex(filename, "."); idx != -1 {
			ext = filename[idx:]
			filename = filename[:idx]
		}
		maxNameLen := 255 - len(ext)
		if len(filename) > maxNameLen {
			filename = filename[:maxNameLen]
		}
		filename = filename + ext
	}

	return filename
}
