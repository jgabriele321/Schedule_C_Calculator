// Package csv provides CSV parsing functionality for bank and credit card statements.
// It handles multiple formats (Chase, Amex, generic) and normalizes data to Transaction structs.
package csv

import (
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"schedccalc/pkg/config"
	"schedccalc/pkg/models"
)

// Format represents the detected CSV format
type Format string

const (
	FormatChase   Format = "chase"
	FormatAmex    Format = "amex"
	FormatGeneric Format = "generic"
)

// Parser handles CSV file parsing
type Parser struct {
	config config.ServerConfig
}

// NewParser creates a new CSV parser
func NewParser(cfg config.ServerConfig) *Parser {
	return &Parser{config: cfg}
}

// ParseFile parses a CSV file and returns transactions
func (p *Parser) ParseFile(filePath, fileID, source, originalFilename string) (*models.ParsedCSVData, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("failed to read CSV: %w", err)
	}

	if len(records) == 0 {
		return nil, fmt.Errorf("CSV file is empty")
	}

	if len(records) < 2 {
		return nil, fmt.Errorf("CSV file must have at least a header and one data row")
	}

	headers := records[0]
	format := DetectFormat(headers)
	cardName := ExtractCardName(originalFilename)

	var transactions []models.Transaction
	var skippedRows []int
	paymentsExcluded := 0

	for i, record := range records[1:] {
		rowNum := i + 2 // 1-indexed, accounting for header

		if len(record) < 3 {
			skippedRows = append(skippedRows, rowNum)
			continue
		}

		transaction, isPayment, err := parseRecord(record, headers, format, fileID, source, cardName)
		if err != nil {
			skippedRows = append(skippedRows, rowNum)
			continue
		}

		if isPayment {
			paymentsExcluded++
			continue
		}

		if transaction != nil {
			transactions = append(transactions, *transaction)
		}
	}

	return &models.ParsedCSVData{
		Transactions:     transactions,
		PaymentsExcluded: paymentsExcluded,
		ParsedCount:      len(transactions),
	}, nil
}

// DetectFormat detects the CSV format based on headers
func DetectFormat(headers []string) Format {
	headerStr := strings.ToLower(strings.Join(headers, ","))

	// Check for Chase format: Status,Date,Description,Debit,Credit
	if strings.Contains(headerStr, "status") && strings.Contains(headerStr, "debit") && strings.Contains(headerStr, "credit") {
		return FormatChase
	}

	// Check for Amex format: Date,Description,Amount,Extended Details,...
	if strings.Contains(headerStr, "amount") && strings.Contains(headerStr, "extended details") {
		return FormatAmex
	}

	// Also check for simpler Amex format
	if strings.Contains(headerStr, "amount") && strings.Contains(headerStr, "description") {
		return FormatAmex
	}

	return FormatGeneric
}

// parseRecord parses a single CSV record into a Transaction
func parseRecord(record []string, headers []string, format Format, fileID, source, cardName string) (*models.Transaction, bool, error) {
	transaction := models.Transaction{
		ID:           uuid.New().String(),
		Card:         cardName,
		SourceFile:   fileID,
		Category:     "uncategorized",
		IsBusiness:   false,
		SortCategory: "zzz_uncategorized",
		SortBusiness: "Personal",
		CreatedAt:    time.Now(),
	}

	// Set type based on source
	switch source {
	case "income":
		transaction.Type = models.TransactionTypeIncome
	case "expenses":
		transaction.Type = models.TransactionTypeExpense
	default:
		transaction.Type = models.TransactionTypeUncategorized
	}

	switch format {
	case FormatChase:
		return parseChaseRecord(record, headers, transaction)
	case FormatAmex:
		return parseAmexRecord(record, headers, transaction)
	default:
		return parseGenericRecord(record, headers, transaction)
	}
}

// parseChaseRecord parses a Chase-format CSV row
func parseChaseRecord(record []string, headers []string, tx models.Transaction) (*models.Transaction, bool, error) {
	headerMap := buildHeaderMap(headers)

	// Extract date
	if dateIdx, ok := headerMap["date"]; ok && dateIdx < len(record) {
		date, err := ParseDate(record[dateIdx])
		if err != nil {
			return nil, false, fmt.Errorf("invalid date: %w", err)
		}
		tx.Date = date
	}

	// Extract description/vendor
	if descIdx, ok := headerMap["description"]; ok && descIdx < len(record) {
		description := strings.TrimSpace(record[descIdx])
		tx.Vendor = CleanVendorName(description)

		if IsPaymentTransaction(description) {
			return nil, true, nil
		}
	}

	// Extract amount (Chase has separate Debit/Credit columns)
	var amount float64
	if debitIdx, ok := headerMap["debit"]; ok && debitIdx < len(record) && record[debitIdx] != "" {
		if debitAmount, err := parseAmount(record[debitIdx]); err == nil {
			amount = debitAmount // Positive for expenses
		}
	}
	if creditIdx, ok := headerMap["credit"]; ok && creditIdx < len(record) && record[creditIdx] != "" {
		if creditAmount, err := parseAmount(record[creditIdx]); err == nil {
			amount = -creditAmount // Negative for refunds/credits
		}
	}

	tx.Amount = amount
	tx.Expensable = amount > 0 && tx.Type == models.TransactionTypeExpense

	return &tx, false, nil
}

// parseAmexRecord parses an Amex-format CSV row
func parseAmexRecord(record []string, headers []string, tx models.Transaction) (*models.Transaction, bool, error) {
	headerMap := buildHeaderMap(headers)

	// Extract date
	if dateIdx, ok := headerMap["date"]; ok && dateIdx < len(record) {
		date, err := ParseDate(record[dateIdx])
		if err != nil {
			return nil, false, fmt.Errorf("invalid date: %w", err)
		}
		tx.Date = date
	}

	// Extract description/vendor
	if descIdx, ok := headerMap["description"]; ok && descIdx < len(record) {
		description := strings.TrimSpace(record[descIdx])
		tx.Vendor = CleanVendorName(description)

		if IsPaymentTransaction(description) {
			return nil, true, nil
		}
	}

	// Extract amount
	if amountIdx, ok := headerMap["amount"]; ok && amountIdx < len(record) {
		amount, err := parseAmount(record[amountIdx])
		if err != nil {
			return nil, false, fmt.Errorf("invalid amount: %w", err)
		}
		tx.Amount = amount
	}

	// Use Amex category if available
	if catIdx, ok := headerMap["category"]; ok && catIdx < len(record) {
		category := strings.TrimSpace(record[catIdx])
		if category != "" {
			tx.Category = category
			tx.SortCategory = strings.ToLower(category)
		}
	}

	tx.Expensable = tx.Amount > 0 && tx.Type == models.TransactionTypeExpense

	return &tx, false, nil
}

// parseGenericRecord parses a generic CSV row
func parseGenericRecord(record []string, headers []string, tx models.Transaction) (*models.Transaction, bool, error) {
	for i, header := range headers {
		if i >= len(record) {
			continue
		}

		headerLower := strings.ToLower(header)
		value := strings.TrimSpace(record[i])

		// Try to parse date
		if strings.Contains(headerLower, "date") && tx.Date.IsZero() {
			if date, err := ParseDate(value); err == nil {
				tx.Date = date
			}
		}

		// Try to parse description/vendor
		if (strings.Contains(headerLower, "description") || strings.Contains(headerLower, "vendor")) && tx.Vendor == "" {
			tx.Vendor = CleanVendorName(value)
			if IsPaymentTransaction(value) {
				return nil, true, nil
			}
		}

		// Try to parse amount
		if strings.Contains(headerLower, "amount") && tx.Amount == 0 {
			if amount, err := parseAmount(value); err == nil {
				tx.Amount = amount
			}
		}
	}

	if tx.Date.IsZero() || tx.Vendor == "" {
		return nil, false, fmt.Errorf("missing required fields (date or vendor)")
	}

	tx.Expensable = tx.Amount > 0 && tx.Type == models.TransactionTypeExpense

	return &tx, false, nil
}

// buildHeaderMap creates a map of lowercase header names to indices
func buildHeaderMap(headers []string) map[string]int {
	headerMap := make(map[string]int)
	for i, header := range headers {
		headerMap[strings.ToLower(header)] = i
	}
	return headerMap
}

// parseAmount parses an amount string, handling currency symbols and formatting
func parseAmount(s string) (float64, error) {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, "$", "")
	s = strings.ReplaceAll(s, ",", "")
	s = strings.ReplaceAll(s, " ", "")
	return strconv.ParseFloat(s, 64)
}

// ParseDate attempts to parse a date string using multiple formats
func ParseDate(dateStr string) (time.Time, error) {
	dateStr = strings.TrimSpace(dateStr)
	
	formats := []string{
		"01/02/2006",
		"1/2/2006",
		"2006-01-02",
		"01-02-2006",
		"1-2-2006",
		"January 2, 2006",
		"Jan 2, 2006",
		"2/1/2006",
		"02/01/2006",
	}

	for _, format := range formats {
		if date, err := time.Parse(format, dateStr); err == nil {
			return date, nil
		}
	}

	return time.Time{}, fmt.Errorf("unable to parse date: %s", dateStr)
}

// IsPaymentTransaction checks if a description represents a payment
func IsPaymentTransaction(description string) bool {
	descLower := strings.ToLower(description)
	for _, keyword := range config.PaymentKeywords {
		if strings.Contains(descLower, keyword) {
			return true
		}
	}
	return false
}

// CleanVendorName cleans up a vendor name from a transaction description
func CleanVendorName(description string) string {
	vendor := strings.TrimSpace(description)

	// Remove common prefixes
	for _, prefix := range config.VendorPrefixes {
		if strings.HasPrefix(vendor, prefix) {
			vendor = vendor[len(prefix):]
			break
		}
	}

	// Remove location suffixes (state codes at end)
	words := strings.Fields(vendor)
	if len(words) > 1 {
		lastWord := words[len(words)-1]
		if len(lastWord) == 2 && strings.ToUpper(lastWord) == lastWord {
			vendor = strings.Join(words[:len(words)-1], " ")
		}
	}

	// Limit length
	if len(vendor) > 50 {
		vendor = vendor[:50]
	}

	return strings.TrimSpace(vendor)
}

// ExtractCardName extracts a card name from a filename
func ExtractCardName(filename string) string {
	cardName := filepath.Base(filename)
	if ext := filepath.Ext(cardName); ext != "" {
		cardName = cardName[:len(cardName)-len(ext)]
	}
	cardName = strings.ReplaceAll(cardName, "_", " ")
	return strings.TrimSpace(cardName)
}

// ValidateFile validates that a file is a valid CSV before parsing
func ValidateFile(filePath string, maxSize int64) error {
	info, err := os.Stat(filePath)
	if err != nil {
		return fmt.Errorf("cannot access file: %w", err)
	}

	if info.Size() == 0 {
		return fmt.Errorf("file is empty")
	}

	if info.Size() > maxSize {
		return fmt.Errorf("file exceeds maximum size of %d bytes", maxSize)
	}

	ext := strings.ToLower(filepath.Ext(filePath))
	if ext != ".csv" {
		return fmt.Errorf("file must have .csv extension")
	}

	return nil
}
