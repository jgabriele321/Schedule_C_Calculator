package main

import (
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
)

type Transaction struct {
	ID         string    `json:"id" db:"id"`
	Date       time.Time `json:"date" db:"date"`
	Vendor     string    `json:"vendor" db:"vendor"`
	Amount     float64   `json:"amount" db:"amount"`
	Card       string    `json:"card" db:"card"`
	Category   string    `json:"category" db:"category"`
	Purpose    string    `json:"purpose" db:"purpose"`
	Expensable bool      `json:"expensable" db:"expensable"`
	Type       string    `json:"type" db:"type"` // "income", "expense", "refund", "uncategorized"
	SourceFile string    `json:"source_file" db:"source_file"`
}

type CSVFile struct {
	ID       string    `json:"id" db:"id"`
	Filename string    `json:"filename" db:"filename"`
	Uploaded time.Time `json:"uploaded" db:"uploaded"`
	Source   string    `json:"source" db:"source"` // "income", "expenses", "both"
}

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

type ParsedCSVData struct {
	Transactions     []Transaction `json:"transactions"`
	PaymentsExcluded int           `json:"payments_excluded"`
	ParsedCount      int           `json:"parsed_count"`
}

var db *sql.DB

func main() {
	// Initialize database
	var err error
	db, err = sql.Open("sqlite3", "./schedccalc.db")
	if err != nil {
		log.Fatal("Failed to open database:", err)
	}
	defer db.Close()

	// Create tables
	err = createTables()
	if err != nil {
		log.Fatal("Failed to create tables:", err)
	}

	// Create uploads directory
	err = os.MkdirAll("uploads", 0755)
	if err != nil {
		log.Fatal("Failed to create uploads directory:", err)
	}

	// Initialize router
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// CORS for frontend communication
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000"}, // Next.js default port
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Routes
	r.Get("/health", healthCheck)
	r.Post("/upload-csv", uploadCSV)
	r.Get("/transactions", getTransactions)
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Schedule C Calculator Backend API",
			"version": "1.0.0",
			"status":  "running",
		})
	})

	fmt.Println("🚀 Server starting on :8080")
	fmt.Println("📊 SQLite database initialized at ./schedccalc.db")
	fmt.Println("📁 Uploads directory created at ./uploads")
	fmt.Println("✅ Health check available at http://localhost:8080/health")
	fmt.Println("📤 CSV upload available at http://localhost:8080/upload-csv")
	fmt.Println("📋 Transactions available at http://localhost:8080/transactions")

	log.Fatal(http.ListenAndServe(":8080", r))
}

func createTables() error {
	// Create transactions table
	transactionsTable := `
	CREATE TABLE IF NOT EXISTS transactions (
		id TEXT PRIMARY KEY,
		date DATETIME,
		vendor TEXT,
		amount REAL,
		card TEXT,
		category TEXT,
		purpose TEXT,
		expensable BOOLEAN DEFAULT FALSE,
		type TEXT,
		source_file TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);`

	// Create csv_files table
	csvFilesTable := `
	CREATE TABLE IF NOT EXISTS csv_files (
		id TEXT PRIMARY KEY,
		filename TEXT,
		uploaded DATETIME,
		source TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);`

	// Create vendor_rules table for future use
	vendorRulesTable := `
	CREATE TABLE IF NOT EXISTS vendor_rules (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		vendor TEXT UNIQUE,
		type TEXT,
		expensable BOOLEAN,
		category TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);`

	// Create deduction_data table for future use
	deductionDataTable := `
	CREATE TABLE IF NOT EXISTS deduction_data (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		business_miles INTEGER DEFAULT 0,
		home_office_sqft INTEGER DEFAULT 0,
		total_home_sqft INTEGER DEFAULT 0,
		use_simplified BOOLEAN DEFAULT TRUE,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);`

	tables := []string{transactionsTable, csvFilesTable, vendorRulesTable, deductionDataTable}

	for _, table := range tables {
		_, err := db.Exec(table)
		if err != nil {
			return fmt.Errorf("error creating table: %v", err)
		}
	}

	fmt.Println("📋 Database tables created successfully")
	return nil
}

func healthCheck(w http.ResponseWriter, r *http.Request) {
	// Test database connection
	err := db.Ping()
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"status": "error",
			"error":  "Database connection failed",
		})
		return
	}

	// Count existing transactions for health info
	var transactionCount int
	db.QueryRow("SELECT COUNT(*) FROM transactions").Scan(&transactionCount)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":            "healthy",
		"database":          "connected",
		"timestamp":         time.Now(),
		"transaction_count": transactionCount,
	})
}

func uploadCSV(w http.ResponseWriter, r *http.Request) {
	// Limit file size to 10MB
	r.ParseMultipartForm(10 << 20)

	// Get file from form
	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "No file provided", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Get source type from form (income, expenses, both)
	source := r.FormValue("source")
	if source == "" {
		source = "expenses" // default
	}

	// Validate source type
	if source != "income" && source != "expenses" && source != "both" {
		http.Error(w, "Invalid source type. Must be: income, expenses, or both", http.StatusBadRequest)
		return
	}

	// Validate file extension
	filename := header.Filename
	if !strings.HasSuffix(strings.ToLower(filename), ".csv") {
		http.Error(w, "Only CSV files are allowed", http.StatusBadRequest)
		return
	}

	// Generate unique file ID
	fileID := uuid.New().String()

	// Create safe filename with ID
	ext := filepath.Ext(filename)
	safeFilename := fmt.Sprintf("%s_%s%s", fileID, strings.ReplaceAll(filename[:len(filename)-len(ext)], " ", "_"), ext)
	tempPath := filepath.Join("uploads", safeFilename)

	// Create the destination file
	dst, err := os.Create(tempPath)
	if err != nil {
		log.Printf("Error creating file: %v", err)
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	// Copy file content
	_, err = io.Copy(dst, file)
	if err != nil {
		log.Printf("Error copying file: %v", err)
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}

	// Parse CSV and extract transactions
	parsedData, err := parseCSVFile(tempPath, fileID, source, filename)
	if err != nil {
		log.Printf("Error parsing CSV: %v", err)
		http.Error(w, fmt.Sprintf("Failed to parse CSV: %v", err), http.StatusInternalServerError)
		return
	}

	// Save transactions to database
	err = saveTransactions(parsedData.Transactions)
	if err != nil {
		log.Printf("Error saving transactions: %v", err)
		http.Error(w, "Failed to save transactions", http.StatusInternalServerError)
		return
	}

	// Save file record to database
	err = saveCSVFileRecord(fileID, filename, source, tempPath)
	if err != nil {
		log.Printf("Error saving file record: %v", err)
		// File was saved but DB record failed - this is recoverable
	}

	// Log successful upload
	log.Printf("📤 CSV processed: %s (ID: %s, Source: %s, Transactions: %d, Payments excluded: %d)",
		filename, fileID, source, parsedData.ParsedCount, parsedData.PaymentsExcluded)

	// Return success response
	response := UploadResponse{
		Success:            true,
		Message:            "File uploaded and processed successfully",
		FileID:             fileID,
		Filename:           filename,
		TempPath:           tempPath,
		Source:             source,
		TransactionsParsed: parsedData.ParsedCount,
		PaymentsExcluded:   parsedData.PaymentsExcluded,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func parseCSVFile(filePath, fileID, source, originalFilename string) (*ParsedCSVData, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %v", err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("failed to read CSV: %v", err)
	}

	if len(records) == 0 {
		return nil, fmt.Errorf("CSV file is empty")
	}

	// Detect CSV format based on headers
	headers := records[0]
	format := detectCSVFormat(headers)

	var transactions []Transaction
	paymentsExcluded := 0

	// Parse transactions based on detected format
	for i, record := range records[1:] { // Skip header row
		if len(record) < len(headers) {
			log.Printf("Skipping malformed row %d", i+2)
			continue
		}

		transaction, isPayment, err := parseTransactionRecord(record, headers, format, fileID, source, originalFilename)
		if err != nil {
			log.Printf("Error parsing row %d: %v", i+2, err)
			continue
		}

		if isPayment {
			paymentsExcluded++
			continue // Skip payments as requested
		}

		if transaction != nil {
			transactions = append(transactions, *transaction)
		}
	}

	return &ParsedCSVData{
		Transactions:     transactions,
		PaymentsExcluded: paymentsExcluded,
		ParsedCount:      len(transactions),
	}, nil
}

func detectCSVFormat(headers []string) string {
	headerStr := strings.ToLower(strings.Join(headers, ","))

	// Check for Chase format: Status,Date,Description,Debit,Credit
	if strings.Contains(headerStr, "status") && strings.Contains(headerStr, "debit") && strings.Contains(headerStr, "credit") {
		return "chase"
	}

	// Check for Amex format: Date,Description,Amount,Extended Details,...
	if strings.Contains(headerStr, "amount") && strings.Contains(headerStr, "extended details") {
		return "amex"
	}

	// Default/generic format
	return "generic"
}

func parseTransactionRecord(record []string, headers []string, format, fileID, source, cardName string) (*Transaction, bool, error) {
	var transaction Transaction
	transaction.ID = uuid.New().String()
	transaction.SourceFile = fileID
	transaction.Card = extractCardName(cardName)

	// Set transaction type based on source
	switch source {
	case "income":
		transaction.Type = "income"
	case "expenses":
		transaction.Type = "expense"
	default:
		transaction.Type = "uncategorized"
	}

	switch format {
	case "chase":
		return parseChaseRecord(record, headers, transaction)
	case "amex":
		return parseAmexRecord(record, headers, transaction)
	default:
		return parseGenericRecord(record, headers, transaction)
	}
}

func parseChaseRecord(record []string, headers []string, transaction Transaction) (*Transaction, bool, error) {
	headerMap := make(map[string]int)
	for i, header := range headers {
		headerMap[strings.ToLower(header)] = i
	}

	// Extract date
	if dateIdx, ok := headerMap["date"]; ok && dateIdx < len(record) {
		date, err := parseDate(record[dateIdx])
		if err != nil {
			return nil, false, fmt.Errorf("invalid date: %v", err)
		}
		transaction.Date = date
	}

	// Extract description/vendor
	if descIdx, ok := headerMap["description"]; ok && descIdx < len(record) {
		description := strings.TrimSpace(record[descIdx])
		transaction.Vendor = extractVendorName(description)

		// Check if this is a payment
		if isPaymentTransaction(description) {
			return nil, true, nil // This is a payment, exclude it
		}
	}

	// Extract amount (Chase has separate Debit/Credit columns)
	var amount float64
	if debitIdx, ok := headerMap["debit"]; ok && debitIdx < len(record) {
		if record[debitIdx] != "" {
			debitAmount, err := strconv.ParseFloat(record[debitIdx], 64)
			if err == nil {
				amount = debitAmount // Positive for expenses
			}
		}
	}
	if creditIdx, ok := headerMap["credit"]; ok && creditIdx < len(record) {
		if record[creditIdx] != "" {
			creditAmount, err := strconv.ParseFloat(record[creditIdx], 64)
			if err == nil {
				amount = -creditAmount // Negative for income/refunds
			}
		}
	}

	transaction.Amount = amount
	transaction.Category = "uncategorized"
	transaction.Purpose = ""
	transaction.Expensable = (amount > 0 && transaction.Type == "expense")

	return &transaction, false, nil
}

func parseAmexRecord(record []string, headers []string, transaction Transaction) (*Transaction, bool, error) {
	headerMap := make(map[string]int)
	for i, header := range headers {
		headerMap[strings.ToLower(header)] = i
	}

	// Extract date
	if dateIdx, ok := headerMap["date"]; ok && dateIdx < len(record) {
		date, err := parseDate(record[dateIdx])
		if err != nil {
			return nil, false, fmt.Errorf("invalid date: %v", err)
		}
		transaction.Date = date
	}

	// Extract description/vendor
	if descIdx, ok := headerMap["description"]; ok && descIdx < len(record) {
		description := strings.TrimSpace(record[descIdx])
		transaction.Vendor = extractVendorName(description)

		// Check if this is a payment
		if isPaymentTransaction(description) {
			return nil, true, nil // This is a payment, exclude it
		}
	}

	// Extract amount (Amex has single Amount column with positive/negative values)
	if amountIdx, ok := headerMap["amount"]; ok && amountIdx < len(record) {
		amount, err := strconv.ParseFloat(record[amountIdx], 64)
		if err != nil {
			return nil, false, fmt.Errorf("invalid amount: %v", err)
		}
		transaction.Amount = amount
	}

	// Use Amex category if available
	if catIdx, ok := headerMap["category"]; ok && catIdx < len(record) {
		category := strings.TrimSpace(record[catIdx])
		if category != "" {
			transaction.Category = category
		} else {
			transaction.Category = "uncategorized"
		}
	} else {
		transaction.Category = "uncategorized"
	}

	transaction.Purpose = ""
	transaction.Expensable = (transaction.Amount > 0 && transaction.Type == "expense")

	return &transaction, false, nil
}

func parseGenericRecord(record []string, headers []string, transaction Transaction) (*Transaction, bool, error) {
	// Generic parser for unknown formats
	// Try to find date, description, and amount columns

	for i, header := range headers {
		if i >= len(record) {
			continue
		}

		headerLower := strings.ToLower(header)
		value := strings.TrimSpace(record[i])

		// Try to parse date
		if strings.Contains(headerLower, "date") && transaction.Date.IsZero() {
			if date, err := parseDate(value); err == nil {
				transaction.Date = date
			}
		}

		// Try to parse description/vendor
		if (strings.Contains(headerLower, "description") || strings.Contains(headerLower, "vendor")) && transaction.Vendor == "" {
			transaction.Vendor = extractVendorName(value)
			if isPaymentTransaction(value) {
				return nil, true, nil // This is a payment, exclude it
			}
		}

		// Try to parse amount
		if strings.Contains(headerLower, "amount") && transaction.Amount == 0 {
			if amount, err := strconv.ParseFloat(value, 64); err == nil {
				transaction.Amount = amount
			}
		}
	}

	if transaction.Date.IsZero() || transaction.Vendor == "" {
		return nil, false, fmt.Errorf("missing required fields (date or vendor)")
	}

	transaction.Category = "uncategorized"
	transaction.Purpose = ""
	transaction.Expensable = (transaction.Amount > 0 && transaction.Type == "expense")

	return &transaction, false, nil
}

func isPaymentTransaction(description string) bool {
	description = strings.ToLower(description)
	paymentKeywords := []string{
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

	for _, keyword := range paymentKeywords {
		if strings.Contains(description, keyword) {
			return true
		}
	}
	return false
}

func extractVendorName(description string) string {
	// Clean up vendor name from description
	vendor := strings.TrimSpace(description)

	// Remove common prefixes
	prefixes := []string{"AplPay ", "TST* ", "SQC*", "GOOGLE *", "PAYPAL *"}
	for _, prefix := range prefixes {
		if strings.HasPrefix(vendor, prefix) {
			vendor = vendor[len(prefix):]
			break
		}
	}

	// Remove location suffixes (state codes at end)
	words := strings.Fields(vendor)
	if len(words) > 1 {
		lastWord := words[len(words)-1]
		// Check if last word is a US state code
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

func extractCardName(filename string) string {
	// Extract card name from filename
	cardName := filename
	if ext := filepath.Ext(cardName); ext != "" {
		cardName = cardName[:len(cardName)-len(ext)]
	}

	// Clean up common patterns
	cardName = strings.ReplaceAll(cardName, "_", " ")
	cardName = strings.TrimSpace(cardName)

	return cardName
}

func parseDate(dateStr string) (time.Time, error) {
	// Try multiple date formats
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

func saveTransactions(transactions []Transaction) error {
	if len(transactions) == 0 {
		return nil
	}

	// Prepare bulk insert
	query := `
		INSERT INTO transactions (id, date, vendor, amount, card, category, purpose, expensable, type, source_file)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	stmt, err := db.Prepare(query)
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %v", err)
	}
	defer stmt.Close()

	for _, tx := range transactions {
		_, err = stmt.Exec(
			tx.ID, tx.Date, tx.Vendor, tx.Amount, tx.Card,
			tx.Category, tx.Purpose, tx.Expensable, tx.Type, tx.SourceFile,
		)
		if err != nil {
			log.Printf("Failed to insert transaction %s: %v", tx.ID, err)
			continue
		}
	}

	log.Printf("💾 Saved %d transactions to database", len(transactions))
	return nil
}

func getTransactions(w http.ResponseWriter, r *http.Request) {
	// Get query parameters for filtering
	highValue := r.URL.Query().Get("highValue")
	threshold := r.URL.Query().Get("threshold")
	recurring := r.URL.Query().Get("recurring")
	txType := r.URL.Query().Get("type")
	card := r.URL.Query().Get("card")

	// Build base query
	query := `
		SELECT id, date, vendor, amount, card, category, purpose, expensable, type, source_file
		FROM transactions
		WHERE 1=1
	`
	args := []interface{}{}

	// Add filters
	if highValue == "true" {
		thresholdValue := 100.0 // default threshold
		if threshold != "" {
			if t, err := strconv.ParseFloat(threshold, 64); err == nil {
				thresholdValue = t
			}
		}
		query += " AND ABS(amount) >= ?"
		args = append(args, thresholdValue)
	}

	if txType != "" && (txType == "income" || txType == "expense" || txType == "uncategorized") {
		query += " AND type = ?"
		args = append(args, txType)
	}

	if card != "" {
		query += " AND card LIKE ?"
		args = append(args, "%"+card+"%")
	}

	// Handle recurring vendors
	if recurring == "true" {
		// First get vendors that appear more than once
		vendorQuery := `
			SELECT vendor FROM transactions 
			GROUP BY vendor 
			HAVING COUNT(*) > 1
		`
		vendorRows, err := db.Query(vendorQuery)
		if err == nil {
			var recurringVendors []string
			for vendorRows.Next() {
				var vendor string
				vendorRows.Scan(&vendor)
				recurringVendors = append(recurringVendors, vendor)
			}
			vendorRows.Close()

			if len(recurringVendors) > 0 {
				placeholders := strings.Repeat("?,", len(recurringVendors)-1) + "?"
				query += " AND vendor IN (" + placeholders + ")"
				for _, vendor := range recurringVendors {
					args = append(args, vendor)
				}
			}
		}
	}

	query += " ORDER BY date DESC"

	rows, err := db.Query(query, args...)
	if err != nil {
		log.Printf("Error querying transactions: %v", err)
		http.Error(w, "Failed to fetch transactions", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var transactions []Transaction
	for rows.Next() {
		var tx Transaction
		err := rows.Scan(&tx.ID, &tx.Date, &tx.Vendor, &tx.Amount, &tx.Card,
			&tx.Category, &tx.Purpose, &tx.Expensable, &tx.Type, &tx.SourceFile)
		if err != nil {
			log.Printf("Error scanning transaction: %v", err)
			continue
		}
		transactions = append(transactions, tx)
	}

	// Calculate summary statistics
	summary := calculateTransactionSummary(transactions)

	response := map[string]interface{}{
		"transactions": transactions,
		"count":        len(transactions),
		"summary":      summary,
		"filters": map[string]interface{}{
			"highValue": highValue == "true",
			"threshold": threshold,
			"recurring": recurring == "true",
			"type":      txType,
			"card":      card,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func calculateTransactionSummary(transactions []Transaction) map[string]interface{} {
	var totalIncome, totalExpenses float64
	var incomeCount, expenseCount int
	vendorCounts := make(map[string]int)

	for _, tx := range transactions {
		// Count vendor frequency
		vendorCounts[tx.Vendor]++

		// Sum by type
		if tx.Type == "income" || tx.Amount < 0 {
			totalIncome += math.Abs(tx.Amount)
			incomeCount++
		} else if tx.Type == "expense" || tx.Amount > 0 {
			totalExpenses += math.Abs(tx.Amount)
			expenseCount++
		}
	}

	// Find recurring vendors (appear more than once)
	var recurringVendors []map[string]interface{}
	for vendor, count := range vendorCounts {
		if count > 1 {
			recurringVendors = append(recurringVendors, map[string]interface{}{
				"vendor": vendor,
				"count":  count,
			})
		}
	}

	return map[string]interface{}{
		"total_income":      totalIncome,
		"total_expenses":    totalExpenses,
		"income_count":      incomeCount,
		"expense_count":     expenseCount,
		"recurring_vendors": recurringVendors,
		"unique_vendors":    len(vendorCounts),
	}
}

func saveCSVFileRecord(fileID, filename, source, tempPath string) error {
	query := `
		INSERT INTO csv_files (id, filename, uploaded, source)
		VALUES (?, ?, ?, ?)
	`

	_, err := db.Exec(query, fileID, filename, time.Now(), source)
	if err != nil {
		return fmt.Errorf("failed to save CSV file record: %v", err)
	}

	return nil
}
