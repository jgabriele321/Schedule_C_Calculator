// Package config provides centralized configuration for the Schedule C Calculator.
// All magic numbers and business constants are defined here for easy maintenance.
package config

import (
	"os"
	"strconv"
)

// IRSRates contains IRS standard rates for deductions
// These should be updated annually when IRS publishes new rates
type IRSRates struct {
	// StandardMileageRate is the IRS standard mileage rate per mile
	// 2024 rate: $0.67 per mile (IRS Notice 2024-XX)
	// Source: https://www.irs.gov/tax-professionals/standard-mileage-rates
	StandardMileageRate float64

	// SimplifiedHomeOfficeRate is the rate per square foot for simplified method
	// Current rate: $5 per square foot
	SimplifiedHomeOfficeRate float64

	// MaxSimplifiedHomeOfficeSqft is the maximum square footage for simplified method
	// Current limit: 300 square feet
	MaxSimplifiedHomeOfficeSqft int

	// TaxYear is the tax year for calculations
	TaxYear int
}

// DefaultIRSRates returns the current IRS rates
// Update these values when IRS publishes new rates for the tax year
func DefaultIRSRates() IRSRates {
	return IRSRates{
		StandardMileageRate:         0.67,  // 2024 IRS standard mileage rate
		SimplifiedHomeOfficeRate:    5.0,   // $5 per square foot
		MaxSimplifiedHomeOfficeSqft: 300,   // Maximum 300 sq ft
		TaxYear:                     2024,
	}
}

// ServerConfig contains HTTP server configuration
type ServerConfig struct {
	Port            string
	AllowedOrigins  []string
	MaxUploadSize   int64  // Maximum file upload size in bytes
	UploadsDir      string // Directory for uploaded files
	DatabasePath    string // Path to SQLite database
}

// DefaultServerConfig returns default server configuration
func DefaultServerConfig() ServerConfig {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	maxUpload := int64(10 << 20) // 10MB default
	if envMax := os.Getenv("MAX_UPLOAD_SIZE"); envMax != "" {
		if parsed, err := strconv.ParseInt(envMax, 10, 64); err == nil {
			maxUpload = parsed
		}
	}

	dbPath := os.Getenv("DATABASE_PATH")
	if dbPath == "" {
		dbPath = "./schedccalc.db"
	}

	uploadsDir := os.Getenv("UPLOADS_DIR")
	if uploadsDir == "" {
		uploadsDir = "./uploads"
	}

	return ServerConfig{
		Port:           port,
		AllowedOrigins: []string{"http://localhost:3000", "http://localhost:3001"},
		MaxUploadSize:  maxUpload,
		UploadsDir:     uploadsDir,
		DatabasePath:   dbPath,
	}
}

// PaginationConfig contains pagination defaults
type PaginationConfig struct {
	DefaultPageSize int
	MaxPageSize     int
	UnlimitedSize   int // Used when unlimited=true
}

// DefaultPaginationConfig returns default pagination settings
func DefaultPaginationConfig() PaginationConfig {
	return PaginationConfig{
		DefaultPageSize: 50,
		MaxPageSize:     200,
		UnlimitedSize:   999999,
	}
}

// LLMConfig contains configuration for LLM-based categorization
type LLMConfig struct {
	APIEndpoint    string
	Model          string
	BatchSize      int
	TimeoutSeconds int
}

// DefaultLLMConfig returns default LLM configuration
func DefaultLLMConfig() LLMConfig {
	return LLMConfig{
		APIEndpoint:    "https://openrouter.ai/api/v1/chat/completions",
		Model:          "anthropic/claude-3.5-sonnet",
		BatchSize:      10,
		TimeoutSeconds: 60,
	}
}

// ScheduleCLines maps category names to IRS Schedule C line numbers
// Reference: IRS Schedule C (Form 1040) Instructions
var ScheduleCLines = map[string]int{
	"Advertising":                        8,
	"Car and truck":                      9,
	"Commissions and fees":               10,
	"Contractors":                        11,
	"Depletion":                          12,
	"Depreciation":                       13,
	"Employee benefit programs":          14,
	"Insurance":                          15,
	"Interest paid":                      16,
	"Legal fees and professional services": 17,
	"Office expenses":                    18,
	"Pension and profit-sharing":         19,
	"Rent and lease":                     20,
	"Repairs and maintenance":            21,
	"Supplies":                           22,
	"Taxes and licenses":                 23,
	"Meals":                              24,
	"Travel expenses":                    25,
	"Utilities":                          26,
	"Other business expenses":            27,
	"Home office":                        30,
}

// ValidScheduleCLineRange defines valid line numbers
const (
	MinScheduleCLine = 8
	MaxScheduleCLine = 27
	HomeOfficeLine   = 30
)

// IsValidScheduleCLine checks if a line number is valid for Schedule C
func IsValidScheduleCLine(line int) bool {
	return (line >= MinScheduleCLine && line <= MaxScheduleCLine) || line == HomeOfficeLine
}

// PaymentKeywords are used to identify and exclude payment transactions
var PaymentKeywords = []string{
	"online payment",
	"payment thank you",
	"payment - thank you",
	"autopay",
	"automatic payment",
	"paypal transfer",
	"venmo payment",
	"zelle payment",
	"wire transfer",
	"transfer to",
	"transfer from",
}

// VendorPrefixes to strip from vendor names for cleaner display
var VendorPrefixes = []string{
	"AplPay ",
	"TST* ",
	"SQC*",
	"GOOGLE *",
	"PAYPAL *",
}

// Config is the global configuration instance
var Config = struct {
	IRS        IRSRates
	Server     ServerConfig
	Pagination PaginationConfig
	LLM        LLMConfig
}{
	IRS:        DefaultIRSRates(),
	Server:     DefaultServerConfig(),
	Pagination: DefaultPaginationConfig(),
	LLM:        DefaultLLMConfig(),
}
