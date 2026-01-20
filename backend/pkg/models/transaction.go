// Package models provides shared data structures for the Schedule C Calculator.
// This is the single source of truth for all transaction-related types.
package models

import (
	"time"
)

// Transaction represents a financial transaction from a bank or credit card statement.
// This is the canonical definition used across all backend services.
type Transaction struct {
	ID            string    `json:"id" db:"id"`
	Date          time.Time `json:"date" db:"date"`
	Vendor        string    `json:"vendor" db:"vendor"`
	Amount        float64   `json:"amount" db:"amount"`
	Card          string    `json:"card" db:"card"`
	Category      string    `json:"category" db:"category"`
	Purpose       string    `json:"purpose" db:"purpose"`
	Expensable    bool      `json:"expensable" db:"expensable"`
	Type          string    `json:"type" db:"type"`                       // "income", "expense", "refund", "uncategorized"
	SourceFile    string    `json:"source_file" db:"source_file"`         // Reference to CSVFile.ID
	ScheduleCLine int       `json:"schedule_c_line" db:"schedule_c_line"` // IRS Schedule C line number (8-27)
	IsBusiness    bool      `json:"is_business" db:"is_business"`         // User toggle for business vs personal
	SortCategory  string    `json:"sort_category" db:"sort_category"`     // Normalized category for sorting
	SortBusiness  string    `json:"sort_business" db:"sort_business"`     // "Business" or "Personal" for sorting
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

// TransactionType constants for the Type field
const (
	TransactionTypeIncome        = "income"
	TransactionTypeExpense       = "expense"
	TransactionTypeRefund        = "refund"
	TransactionTypeUncategorized = "uncategorized"
)

// CSVFile represents an uploaded CSV file record
type CSVFile struct {
	ID        string    `json:"id" db:"id"`
	Filename  string    `json:"filename" db:"filename"`
	Uploaded  time.Time `json:"uploaded" db:"uploaded"`
	Source    string    `json:"source" db:"source"` // "income", "expenses", "both"
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// DeductionData stores vehicle mileage and home office deduction information
type DeductionData struct {
	ID             int       `json:"id" db:"id"`
	BusinessMiles  int       `json:"business_miles" db:"business_miles"`
	HomeOfficeSqft int       `json:"home_office_sqft" db:"home_office_sqft"`
	TotalHomeSqft  int       `json:"total_home_sqft" db:"total_home_sqft"`
	UseSimplified  bool      `json:"use_simplified" db:"use_simplified"`
	UpdatedAt      time.Time `json:"updated_at" db:"updated_at"`
}

// VendorRule defines automatic categorization rules for vendors
type VendorRule struct {
	ID            int       `json:"id" db:"id"`
	Vendor        string    `json:"vendor" db:"vendor"`
	Type          string    `json:"type" db:"type"`
	Expensable    bool      `json:"expensable" db:"expensable"`
	Category      string    `json:"category" db:"category"`
	ScheduleCLine int       `json:"schedule_c_line" db:"schedule_c_line"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

// ScheduleCCategory represents an IRS Schedule C expense category
type ScheduleCCategory struct {
	ID          int    `json:"id" db:"id"`
	Name        string `json:"name" db:"name"`
	LineNumber  int    `json:"line_number" db:"line_number"`
	Description string `json:"description" db:"description"`
}

// ExpenseClassification is returned by the LLM categorization service
type ExpenseClassification struct {
	Category      string  `json:"category"`
	ScheduleCLine int     `json:"schedule_c_line"`
	Expensable    bool    `json:"expensable"`
	Purpose       string  `json:"purpose"`
	Confidence    float64 `json:"confidence"`
}

// ParsedCSVData contains the results of parsing a CSV file
type ParsedCSVData struct {
	Transactions     []Transaction `json:"transactions"`
	PaymentsExcluded int           `json:"payments_excluded"`
	ParsedCount      int           `json:"parsed_count"`
}

// UploadResponse is returned after a successful CSV upload
type UploadResponse struct {
	Success            bool   `json:"success"`
	Message            string `json:"message"`
	FileID             string `json:"file_id"`
	Filename           string `json:"filename"`
	TempPath           string `json:"temp_path"`
	Source             string `json:"source"`
	TransactionsParsed int    `json:"transactions_parsed"`
	PaymentsExcluded   int    `json:"payments_excluded"`
}

// ScheduleCSummary contains calculated Schedule C line items
type ScheduleCSummary struct {
	TaxYear         int                    `json:"tax_year"`
	CalculationDate string                 `json:"calculation_date"`
	LineItems       map[string]float64     `json:"schedule_c"`
	Summary         map[string]interface{} `json:"summary"`
}

// BusinessSummary provides an overview of business vs personal transactions
type BusinessSummary struct {
	BusinessIncome    float64 `json:"business_income"`
	BusinessExpenses  float64 `json:"business_expenses"`
	NetProfitLoss     float64 `json:"net_profit_loss"`
	BusinessTxCount   int     `json:"business_income_transactions"`
	BusinessExpCount  int     `json:"business_expense_transactions"`
	PersonalTxCount   int     `json:"personal_transactions"`
}
