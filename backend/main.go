package main

import (
	"bytes"
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"log"
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
	"github.com/joho/godotenv"
	_ "github.com/mattn/go-sqlite3"
)

type Transaction struct {
	ID            string    `json:"id" db:"id"`
	Date          time.Time `json:"date" db:"date"`
	Vendor        string    `json:"vendor" db:"vendor"`
	Amount        float64   `json:"amount" db:"amount"`
	Card          string    `json:"card" db:"card"`
	Category      string    `json:"category" db:"category"`
	Purpose       string    `json:"purpose" db:"purpose"`
	Expensable    bool      `json:"expensable" db:"expensable"`
	Type          string    `json:"type" db:"type"` // "income", "expense", "refund", "uncategorized"
	SourceFile    string    `json:"source_file" db:"source_file"`
	ScheduleCLine int       `json:"schedule_c_line" db:"schedule_c_line"` // IRS Schedule C line number
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

// OpenRouter API structures
type OpenRouterRequest struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type OpenRouterResponse struct {
	Choices []Choice `json:"choices"`
}

type Choice struct {
	Message Message `json:"message"`
}

type ExpenseClassification struct {
	Category      string  `json:"category"`
	ScheduleCLine int     `json:"schedule_c_line"`
	Expensable    bool    `json:"expensable"`
	Purpose       string  `json:"purpose"`
	Confidence    float64 `json:"confidence"`
}

type VendorRule struct {
	ID            int    `json:"id" db:"id"`
	Vendor        string `json:"vendor" db:"vendor"`
	Type          string `json:"type" db:"type"`
	Expensable    bool   `json:"expensable" db:"expensable"`
	Category      string `json:"category" db:"category"`
	ScheduleCLine int    `json:"schedule_c_line" db:"schedule_c_line"`
	CreatedAt     string `json:"created_at" db:"created_at"`
}

var db *sql.DB
var openRouterAPIKey string

func main() {
	// Load environment variables
	if err := godotenv.Load("../.env"); err != nil {
		log.Printf("Warning: Could not load .env file: %v", err)
	}

	openRouterAPIKey = os.Getenv("OPENROUTER_API_KEY")
	if openRouterAPIKey == "" {
		log.Fatal("OPENROUTER_API_KEY environment variable is required")
	}

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
	r.Post("/categorize", categorizeTransactions)
	r.Post("/classify", classifyTransaction)
	r.Post("/vendor-rule", createVendorRule)
	r.Get("/vendor-rules", getVendorRules)
	r.Post("/apply-rules", applyVendorRules)
	r.Post("/vehicle", updateVehicleDeduction)
	r.Post("/home-office", updateHomeOfficeDeduction)
	r.Get("/deductions", getDeductions)
	r.Get("/summary", getScheduleCSummary)
	r.Post("/fix-income", fixIncomeTransactions)
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
	fmt.Println("🧠 LLM categorization available at http://localhost:8080/categorize")

	log.Fatal(http.ListenAndServe(":8080", r))
}

func createTables() error {
	// Create transactions table (updated with schedule_c_line)
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
		schedule_c_line INTEGER DEFAULT 0,
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
		schedule_c_line INTEGER DEFAULT 0,
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

	// Add schedule_c_line column if it doesn't exist (for existing databases)
	_, err := db.Exec("ALTER TABLE transactions ADD COLUMN schedule_c_line INTEGER DEFAULT 0")
	if err != nil && !strings.Contains(err.Error(), "duplicate column name") {
		log.Printf("Warning: Could not add schedule_c_line column: %v", err)
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

	// Prepare bulk insert (updated with schedule_c_line)
	query := `
		INSERT INTO transactions (id, date, vendor, amount, card, category, purpose, expensable, type, source_file, schedule_c_line)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	stmt, err := db.Prepare(query)
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %v", err)
	}
	defer stmt.Close()

	for _, tx := range transactions {
		_, err = stmt.Exec(
			tx.ID, tx.Date, tx.Vendor, tx.Amount, tx.Card,
			tx.Category, tx.Purpose, tx.Expensable, tx.Type, tx.SourceFile, tx.ScheduleCLine,
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
	category := r.URL.Query().Get("category")

	// Build base query (updated with schedule_c_line)
	query := `
		SELECT id, date, vendor, amount, card, category, purpose, expensable, type, source_file, schedule_c_line
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

	if category != "" {
		query += " AND category LIKE ?"
		args = append(args, "%"+category+"%")
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
			&tx.Category, &tx.Purpose, &tx.Expensable, &tx.Type, &tx.SourceFile, &tx.ScheduleCLine)
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
			"category":  category,
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

		// Sum by type - negative amounts are refunds/credits, not income
		if tx.Type == "income" && tx.Amount > 0 {
			totalIncome += tx.Amount
			incomeCount++
		} else if tx.Type == "expense" && tx.Amount > 0 {
			totalExpenses += tx.Amount
			expenseCount++
		}
		// Note: Negative amounts (refunds/credits) are excluded from both income and expenses
		// They serve as reminders that the original expense should be offset
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

func categorizeTransactions(w http.ResponseWriter, r *http.Request) {
	// Get uncategorized transactions
	query := `
		SELECT id, vendor, amount, category, purpose, type
		FROM transactions 
		WHERE category = 'uncategorized' OR category = ''
		ORDER BY date DESC
		LIMIT 50
	`

	rows, err := db.Query(query)
	if err != nil {
		http.Error(w, "Failed to fetch transactions", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var transactions []Transaction
	for rows.Next() {
		var tx Transaction
		err := rows.Scan(&tx.ID, &tx.Vendor, &tx.Amount, &tx.Category, &tx.Purpose, &tx.Type)
		if err != nil {
			log.Printf("Error scanning transaction: %v", err)
			continue
		}
		transactions = append(transactions, tx)
	}

	if len(transactions) == 0 {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":   true,
			"message":   "No uncategorized transactions found",
			"processed": 0,
		})
		return
	}

	// Process transactions in batches
	processed := 0
	for _, tx := range transactions {
		classification, err := classifyTransactionWithLLM(tx)
		if err != nil {
			log.Printf("Failed to classify transaction %s: %v", tx.ID, err)
			continue
		}

		// Update transaction with classification
		err = updateTransactionClassification(tx.ID, classification)
		if err != nil {
			log.Printf("Failed to update transaction %s: %v", tx.ID, err)
			continue
		}

		processed++
		log.Printf("🏷️ Classified: %s -> %s (Line %d)", tx.Vendor, classification.Category, classification.ScheduleCLine)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"message":   fmt.Sprintf("Processed %d transactions", processed),
		"processed": processed,
		"total":     len(transactions),
	})
}

func classifyTransaction(w http.ResponseWriter, r *http.Request) {
	var request struct {
		TransactionID string `json:"transaction_id"`
		Category      string `json:"category,omitempty"`
		Purpose       string `json:"purpose,omitempty"`
		Expensable    *bool  `json:"expensable,omitempty"`
		ScheduleCLine *int   `json:"schedule_c_line,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if request.TransactionID == "" {
		http.Error(w, "Transaction ID is required", http.StatusBadRequest)
		return
	}

	// Manual classification - update the transaction directly
	updateQuery := `
		UPDATE transactions 
		SET category = COALESCE(?, category),
		    purpose = COALESCE(?, purpose),
		    expensable = COALESCE(?, expensable),
		    schedule_c_line = COALESCE(?, schedule_c_line)
		WHERE id = ?
	`

	_, err := db.Exec(updateQuery,
		nullString(request.Category),
		nullString(request.Purpose),
		request.Expensable,
		request.ScheduleCLine,
		request.TransactionID)

	if err != nil {
		log.Printf("Failed to update transaction: %v", err)
		http.Error(w, "Failed to update transaction", http.StatusInternalServerError)
		return
	}

	log.Printf("📝 Manual classification: Transaction %s updated", request.TransactionID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Transaction updated successfully",
	})
}

func classifyTransactionWithLLM(tx Transaction) (*ExpenseClassification, error) {
	prompt := fmt.Sprintf(`You are an expert tax accountant specializing in Schedule C business expenses. 

Please categorize this business transaction and provide the corresponding IRS Schedule C line number:

Vendor: %s
Amount: $%.2f
Description: %s

Based on this information, provide a JSON response with:
1. category: Business expense category (e.g., "Travel", "Meals", "Software", "Office Supplies", "Professional Services", "Marketing", "Equipment", "Insurance", etc.)
2. schedule_c_line: IRS Schedule C line number (8-27 for deductible business expenses, or 0 if not deductible)
3. expensable: true/false if this is a legitimate business expense
4. purpose: Brief business purpose description
5. confidence: 0.0-1.0 confidence score

IRS Schedule C Line Reference:
- Line 8: Advertising
- Line 9: Car and truck expenses  
- Line 10: Commissions and fees
- Line 11: Contract labor
- Line 12: Depletion
- Line 13: Depreciation
- Line 14: Employee benefit programs
- Line 15: Insurance (other than health)
- Line 16: Interest (mortgage, other)
- Line 17: Legal and professional services
- Line 18: Office expense
- Line 19: Pension and profit-sharing plans
- Line 20: Rent or lease (vehicles, equipment, other)
- Line 21: Repairs and maintenance
- Line 22: Supplies
- Line 23: Taxes and licenses
- Line 24: Travel and meals
- Line 25: Utilities
- Line 26: Wages
- Line 27: Other expenses

Respond with ONLY valid JSON:`, tx.Vendor, tx.Amount, tx.Purpose)

	requestBody := OpenRouterRequest{
		Model: "anthropic/claude-3.5-sonnet",
		Messages: []Message{
			{
				Role:    "user",
				Content: prompt,
			},
		},
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %v", err)
	}

	req, err := http.NewRequest("POST", "https://openrouter.ai/api/v1/chat/completions", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+openRouterAPIKey)
	req.Header.Set("HTTP-Referer", "https://github.com/jgabriele321/Schedule_C_Calculator")
	req.Header.Set("X-Title", "Schedule C Calculator")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("OpenRouter API error %d: %s", resp.StatusCode, string(body))
	}

	var openRouterResp OpenRouterResponse
	if err := json.NewDecoder(resp.Body).Decode(&openRouterResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %v", err)
	}

	if len(openRouterResp.Choices) == 0 {
		return nil, fmt.Errorf("no response from LLM")
	}

	content := openRouterResp.Choices[0].Message.Content

	var classification ExpenseClassification
	if err := json.Unmarshal([]byte(content), &classification); err != nil {
		return nil, fmt.Errorf("failed to parse LLM response: %v", err)
	}

	return &classification, nil
}

func updateTransactionClassification(transactionID string, classification *ExpenseClassification) error {
	query := `
		UPDATE transactions 
		SET category = ?, 
		    purpose = ?, 
		    expensable = ?, 
		    schedule_c_line = ?
		WHERE id = ?
	`

	_, err := db.Exec(query,
		classification.Category,
		classification.Purpose,
		classification.Expensable,
		classification.ScheduleCLine,
		transactionID)

	return err
}

func nullString(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func createVendorRule(w http.ResponseWriter, r *http.Request) {
	var rule VendorRule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if rule.Vendor == "" || rule.Category == "" {
		http.Error(w, "Vendor and category are required", http.StatusBadRequest)
		return
	}

	// Insert vendor rule
	query := `
		INSERT INTO vendor_rules (vendor, type, expensable, category, schedule_c_line)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(vendor) DO UPDATE SET
			type = excluded.type,
			expensable = excluded.expensable,
			category = excluded.category,
			schedule_c_line = excluded.schedule_c_line
	`

	result, err := db.Exec(query, rule.Vendor, rule.Type, rule.Expensable, rule.Category, rule.ScheduleCLine)
	if err != nil {
		log.Printf("Failed to create vendor rule: %v", err)
		http.Error(w, "Failed to create vendor rule", http.StatusInternalServerError)
		return
	}

	ruleID, _ := result.LastInsertId()
	rule.ID = int(ruleID)

	log.Printf("📋 Created vendor rule: %s -> %s (Line %d)", rule.Vendor, rule.Category, rule.ScheduleCLine)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Vendor rule created successfully",
		"rule":    rule,
	})
}

func getVendorRules(w http.ResponseWriter, r *http.Request) {
	query := `
		SELECT id, vendor, type, expensable, category, schedule_c_line, created_at
		FROM vendor_rules
		ORDER BY created_at DESC
	`

	rows, err := db.Query(query)
	if err != nil {
		log.Printf("Error querying vendor rules: %v", err)
		http.Error(w, "Failed to fetch vendor rules", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var rules []VendorRule
	for rows.Next() {
		var rule VendorRule
		err := rows.Scan(&rule.ID, &rule.Vendor, &rule.Type, &rule.Expensable, &rule.Category, &rule.ScheduleCLine, &rule.CreatedAt)
		if err != nil {
			log.Printf("Error scanning vendor rule: %v", err)
			continue
		}
		rules = append(rules, rule)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"rules":   rules,
		"count":   len(rules),
	})
}

func applyVendorRules(w http.ResponseWriter, r *http.Request) {
	// Get all vendor rules
	rulesQuery := `
		SELECT vendor, type, expensable, category, schedule_c_line
		FROM vendor_rules
	`

	rulesRows, err := db.Query(rulesQuery)
	if err != nil {
		http.Error(w, "Failed to fetch vendor rules", http.StatusInternalServerError)
		return
	}
	defer rulesRows.Close()

	// Build a map of vendor rules
	vendorRules := make(map[string]VendorRule)
	for rulesRows.Next() {
		var rule VendorRule
		err := rulesRows.Scan(&rule.Vendor, &rule.Type, &rule.Expensable, &rule.Category, &rule.ScheduleCLine)
		if err != nil {
			log.Printf("Error scanning vendor rule: %v", err)
			continue
		}
		vendorRules[rule.Vendor] = rule
	}

	if len(vendorRules) == 0 {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "No vendor rules found",
			"applied": 0,
		})
		return
	}

	// Apply rules to matching transactions
	applied := 0
	for vendor, rule := range vendorRules {
		updateQuery := `
			UPDATE transactions 
			SET category = ?, 
			    expensable = ?, 
			    schedule_c_line = ?,
			    type = ?
			WHERE vendor LIKE ? AND (category = 'uncategorized' OR category = '')
		`

		result, err := db.Exec(updateQuery, rule.Category, rule.Expensable, rule.ScheduleCLine, rule.Type, "%"+vendor+"%")
		if err != nil {
			log.Printf("Failed to apply rule for vendor %s: %v", vendor, err)
			continue
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected > 0 {
			applied += int(rowsAffected)
			log.Printf("📋 Applied rule: %s -> %s (%d transactions)", vendor, rule.Category, rowsAffected)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Applied vendor rules to %d transactions", applied),
		"applied": applied,
		"rules":   len(vendorRules),
	})
}

func updateVehicleDeduction(w http.ResponseWriter, r *http.Request) {
	var request struct {
		BusinessMiles int `json:"business_miles"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if request.BusinessMiles < 0 {
		http.Error(w, "Business miles must be non-negative", http.StatusBadRequest)
		return
	}

	// Update or insert vehicle deduction data
	query := `
		INSERT INTO deduction_data (business_miles, updated_at)
		VALUES (?, CURRENT_TIMESTAMP)
		ON CONFLICT(id) DO UPDATE SET
			business_miles = excluded.business_miles,
			updated_at = CURRENT_TIMESTAMP
	`

	_, err := db.Exec(query, request.BusinessMiles)
	if err != nil {
		log.Printf("Failed to update vehicle deduction: %v", err)
		http.Error(w, "Failed to update vehicle deduction", http.StatusInternalServerError)
		return
	}

	// Calculate deduction at $0.67/mile (2024 IRS rate)
	mileageRate := 0.67
	deduction := float64(request.BusinessMiles) * mileageRate

	log.Printf("🚗 Vehicle deduction updated: %d miles × $%.2f = $%.2f", request.BusinessMiles, mileageRate, deduction)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":        true,
		"message":        "Vehicle deduction updated successfully",
		"business_miles": request.BusinessMiles,
		"rate_per_mile":  mileageRate,
		"deduction":      deduction,
	})
}

func updateHomeOfficeDeduction(w http.ResponseWriter, r *http.Request) {
	var request struct {
		HomeOfficeSqft int  `json:"home_office_sqft"`
		TotalHomeSqft  int  `json:"total_home_sqft"`
		UseSimplified  bool `json:"use_simplified"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if request.HomeOfficeSqft < 0 || request.TotalHomeSqft < 0 {
		http.Error(w, "Square footage must be non-negative", http.StatusBadRequest)
		return
	}

	if !request.UseSimplified && request.TotalHomeSqft > 0 && request.HomeOfficeSqft > request.TotalHomeSqft {
		http.Error(w, "Home office square footage cannot exceed total home square footage", http.StatusBadRequest)
		return
	}

	// Update or insert home office deduction data
	query := `
		INSERT INTO deduction_data (home_office_sqft, total_home_sqft, use_simplified, updated_at)
		VALUES (?, ?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(id) DO UPDATE SET
			home_office_sqft = excluded.home_office_sqft,
			total_home_sqft = excluded.total_home_sqft,
			use_simplified = excluded.use_simplified,
			updated_at = CURRENT_TIMESTAMP
	`

	_, err := db.Exec(query, request.HomeOfficeSqft, request.TotalHomeSqft, request.UseSimplified)
	if err != nil {
		log.Printf("Failed to update home office deduction: %v", err)
		http.Error(w, "Failed to update home office deduction", http.StatusInternalServerError)
		return
	}

	// Calculate deduction
	var deduction float64
	var method string

	if request.UseSimplified {
		// Simplified method: $5 per square foot, max 300 sqft
		maxSqft := 300
		sqft := request.HomeOfficeSqft
		if sqft > maxSqft {
			sqft = maxSqft
		}
		deduction = float64(sqft) * 5.0
		method = "simplified"
	} else {
		// Actual expense method: percentage of home expenses
		// This would typically require total home expenses input, defaulting to 0 for now
		if request.TotalHomeSqft > 0 {
			percentage := float64(request.HomeOfficeSqft) / float64(request.TotalHomeSqft)
			deduction = 0.0 // Would multiply by total home expenses
			method = fmt.Sprintf("actual (%.1f%% of home)", percentage*100)
		}
	}

	log.Printf("🏠 Home office deduction updated: %d sqft, %s method = $%.2f", request.HomeOfficeSqft, method, deduction)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":          true,
		"message":          "Home office deduction updated successfully",
		"home_office_sqft": request.HomeOfficeSqft,
		"total_home_sqft":  request.TotalHomeSqft,
		"use_simplified":   request.UseSimplified,
		"method":           method,
		"deduction":        deduction,
	})
}

func getDeductions(w http.ResponseWriter, r *http.Request) {
	query := `
		SELECT business_miles, home_office_sqft, total_home_sqft, use_simplified, updated_at
		FROM deduction_data
		ORDER BY updated_at DESC
		LIMIT 1
	`

	var businessMiles, homeOfficeSqft, totalHomeSqft int
	var useSimplified bool
	var updatedAt string

	err := db.QueryRow(query).Scan(&businessMiles, &homeOfficeSqft, &totalHomeSqft, &useSimplified, &updatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			// No deduction data found, return defaults
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success":               true,
				"business_miles":        0,
				"home_office_sqft":      0,
				"total_home_sqft":       0,
				"use_simplified":        true,
				"vehicle_deduction":     0.0,
				"home_office_deduction": 0.0,
				"updated_at":            nil,
			})
			return
		}
		log.Printf("Error querying deductions: %v", err)
		http.Error(w, "Failed to fetch deductions", http.StatusInternalServerError)
		return
	}

	// Calculate deductions
	vehicleDeduction := float64(businessMiles) * 0.67

	var homeOfficeDeduction float64
	if useSimplified {
		maxSqft := 300
		sqft := homeOfficeSqft
		if sqft > maxSqft {
			sqft = maxSqft
		}
		homeOfficeDeduction = float64(sqft) * 5.0
	} else {
		// Actual method would require total home expenses
		homeOfficeDeduction = 0.0
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":               true,
		"business_miles":        businessMiles,
		"home_office_sqft":      homeOfficeSqft,
		"total_home_sqft":       totalHomeSqft,
		"use_simplified":        useSimplified,
		"vehicle_deduction":     vehicleDeduction,
		"home_office_deduction": homeOfficeDeduction,
		"updated_at":            updatedAt,
	})
}

func getScheduleCSummary(w http.ResponseWriter, r *http.Request) {
	// Initialize Schedule C line items
	scheduleC := map[string]interface{}{
		// Income
		"line1_gross_receipts": 0.0,

		// Expenses (Lines 8-27)
		"line8_advertising":          0.0,
		"line9_car_truck":            0.0,
		"line10_commissions_fees":    0.0,
		"line11_contract_labor":      0.0,
		"line12_depletion":           0.0,
		"line13_depreciation":        0.0,
		"line14_employee_benefits":   0.0,
		"line15_insurance":           0.0,
		"line16_interest":            0.0,
		"line17_legal_professional":  0.0,
		"line18_office_expense":      0.0,
		"line19_pension_profit":      0.0,
		"line20_rent_lease":          0.0,
		"line21_repairs_maintenance": 0.0,
		"line22_supplies":            0.0,
		"line23_taxes_licenses":      0.0,
		"line24_travel_meals":        0.0,
		"line25_utilities":           0.0,
		"line26_wages":               0.0,
		"line27_other_expenses":      0.0,

		// Special deductions
		"line30_home_office": 0.0,

		// Calculated fields
		"line28_total_expenses":  0.0,
		"line31_net_profit_loss": 0.0,
	}

	// Get all income transactions
	incomeQuery := `
		SELECT SUM(ABS(amount)) 
		FROM transactions 
		WHERE type = 'income' AND expensable = true
	`
	var grossReceipts sql.NullFloat64
	err := db.QueryRow(incomeQuery).Scan(&grossReceipts)
	if err != nil && err != sql.ErrNoRows {
		log.Printf("Error calculating gross receipts: %v", err)
	}
	if grossReceipts.Valid {
		scheduleC["line1_gross_receipts"] = grossReceipts.Float64
	}

	// Get expenses by Schedule C line number
	expenseQuery := `
		SELECT schedule_c_line, SUM(ABS(amount)) 
		FROM transactions 
		WHERE type = 'expense' AND expensable = true AND schedule_c_line > 0
		GROUP BY schedule_c_line
	`

	expenseRows, err := db.Query(expenseQuery)
	if err != nil {
		log.Printf("Error querying expenses: %v", err)
		http.Error(w, "Failed to calculate expenses", http.StatusInternalServerError)
		return
	}
	defer expenseRows.Close()

	var totalExpenses float64
	for expenseRows.Next() {
		var lineNumber int
		var amount float64
		err := expenseRows.Scan(&lineNumber, &amount)
		if err != nil {
			log.Printf("Error scanning expense row: %v", err)
			continue
		}

		// Map to Schedule C lines
		switch lineNumber {
		case 8:
			scheduleC["line8_advertising"] = amount
		case 9:
			scheduleC["line9_car_truck"] = amount
		case 10:
			scheduleC["line10_commissions_fees"] = amount
		case 11:
			scheduleC["line11_contract_labor"] = amount
		case 12:
			scheduleC["line12_depletion"] = amount
		case 13:
			scheduleC["line13_depreciation"] = amount
		case 14:
			scheduleC["line14_employee_benefits"] = amount
		case 15:
			scheduleC["line15_insurance"] = amount
		case 16:
			scheduleC["line16_interest"] = amount
		case 17:
			scheduleC["line17_legal_professional"] = amount
		case 18:
			scheduleC["line18_office_expense"] = amount
		case 19:
			scheduleC["line19_pension_profit"] = amount
		case 20:
			scheduleC["line20_rent_lease"] = amount
		case 21:
			scheduleC["line21_repairs_maintenance"] = amount
		case 22:
			scheduleC["line22_supplies"] = amount
		case 23:
			scheduleC["line23_taxes_licenses"] = amount
		case 24:
			scheduleC["line24_travel_meals"] = amount
		case 25:
			scheduleC["line25_utilities"] = amount
		case 26:
			scheduleC["line26_wages"] = amount
		case 27:
			scheduleC["line27_other_expenses"] = amount
		}

		totalExpenses += amount
	}

	// Get vehicle deduction and add to Line 9 (Car and truck expenses)
	deductionQuery := `
		SELECT business_miles, home_office_sqft, use_simplified
		FROM deduction_data
		ORDER BY updated_at DESC
		LIMIT 1
	`

	var businessMiles, homeOfficeSqft int
	var useSimplified bool
	err = db.QueryRow(deductionQuery).Scan(&businessMiles, &homeOfficeSqft, &useSimplified)
	if err == nil {
		// Vehicle deduction (Line 9)
		vehicleDeduction := float64(businessMiles) * 0.67
		currentLine9 := scheduleC["line9_car_truck"].(float64)
		scheduleC["line9_car_truck"] = currentLine9 + vehicleDeduction
		totalExpenses += vehicleDeduction

		// Home office deduction (Line 30)
		var homeOfficeDeduction float64
		if useSimplified {
			maxSqft := 300
			sqft := homeOfficeSqft
			if sqft > maxSqft {
				sqft = maxSqft
			}
			homeOfficeDeduction = float64(sqft) * 5.0
		}
		scheduleC["line30_home_office"] = homeOfficeDeduction
		totalExpenses += homeOfficeDeduction
	}

	// Calculate totals
	scheduleC["line28_total_expenses"] = totalExpenses
	grossReceiptsValue := scheduleC["line1_gross_receipts"].(float64)
	netProfitLoss := grossReceiptsValue - totalExpenses
	scheduleC["line31_net_profit_loss"] = netProfitLoss

	// Get transaction counts for summary
	countQuery := `
		SELECT 
			COUNT(CASE WHEN type = 'income' AND expensable = true THEN 1 END) as income_transactions,
			COUNT(CASE WHEN type = 'expense' AND expensable = true THEN 1 END) as expense_transactions,
			COUNT(CASE WHEN category = 'uncategorized' THEN 1 END) as uncategorized_transactions
		FROM transactions
	`

	var incomeCount, expenseCount, uncategorizedCount int
	err = db.QueryRow(countQuery).Scan(&incomeCount, &expenseCount, &uncategorizedCount)
	if err != nil {
		log.Printf("Error getting transaction counts: %v", err)
	}

	// Build response
	response := map[string]interface{}{
		"success":    true,
		"schedule_c": scheduleC,
		"summary": map[string]interface{}{
			"gross_receipts":             grossReceiptsValue,
			"total_expenses":             totalExpenses,
			"net_profit_loss":            netProfitLoss,
			"income_transactions":        incomeCount,
			"expense_transactions":       expenseCount,
			"uncategorized_transactions": uncategorizedCount,
			"vehicle_miles":              businessMiles,
			"home_office_sqft":           homeOfficeSqft,
		},
		"tax_year":         2024,
		"calculation_date": time.Now().Format("2006-01-02 15:04:05"),
	}

	log.Printf("📊 Schedule C Summary: Gross Receipts $%.2f - Total Expenses $%.2f = Net Profit/Loss $%.2f",
		grossReceiptsValue, totalExpenses, netProfitLoss)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func fixIncomeTransactions(w http.ResponseWriter, r *http.Request) {
	// Update all transactions marked as "income" to "expense" since they're misclassified
	updateQuery := `
		UPDATE transactions 
		SET type = 'expense',
		    expensable = true
		WHERE type = 'income'
	`

	result, err := db.Exec(updateQuery)
	if err != nil {
		log.Printf("Failed to fix income transactions: %v", err)
		http.Error(w, "Failed to fix income transactions", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()

	log.Printf("🔧 Fixed %d misclassified income transactions → expense", rowsAffected)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":              true,
		"message":              fmt.Sprintf("Fixed %d misclassified income transactions", rowsAffected),
		"transactions_updated": rowsAffected,
	})
}
