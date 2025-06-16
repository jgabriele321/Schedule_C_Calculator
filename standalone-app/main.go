package main

import (
	"database/sql"
	"embed"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
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
	"github.com/jung-kurt/gofpdf"
	_ "github.com/mattn/go-sqlite3"
)

//go:embed frontend/*
var frontendFS embed.FS

type Transaction struct {
	ID            string    `json:"id" db:"id"`
	Date          time.Time `json:"date" db:"date"`
	Vendor        string    `json:"vendor" db:"vendor"`
	Amount        float64   `json:"amount" db:"amount"`
	Card          string    `json:"card" db:"card"`
	Category      string    `json:"category" db:"category"`
	Purpose       string    `json:"purpose" db:"purpose"`
	Expensable    bool      `json:"expensable" db:"expensable"`
	Type          string    `json:"type" db:"type"`
	SourceFile    string    `json:"source_file" db:"source_file"`
	ScheduleCLine int       `json:"schedule_c_line" db:"schedule_c_line"`
	IsBusiness    bool      `json:"is_business" db:"is_business"`
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
	// Get the executable directory to store the database
	execPath, err := os.Executable()
	if err != nil {
		log.Fatal("Failed to get executable path:", err)
	}
	execDir := filepath.Dir(execPath)

	// Initialize database in the same directory as the executable
	dbPath := filepath.Join(execDir, "schedccalc.db")
	db, err = sql.Open("sqlite3", dbPath)
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
	uploadsDir := filepath.Join(execDir, "uploads")
	err = os.MkdirAll(uploadsDir, 0755)
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
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// API Routes (both with and without /api prefix for compatibility)
	r.Get("/health", healthCheck)
	r.Post("/upload-csv", uploadCSV)
	r.Get("/transactions", getTransactions)
	r.Post("/toggle-business", toggleBusinessStatus)
	r.Post("/toggle-all-business", toggleAllBusinessStatus)
	r.Post("/vehicle", updateVehicleDeduction)
	r.Post("/home-office", updateHomeOfficeDeduction)
	r.Get("/deductions", getDeductions)
	r.Get("/summary", getScheduleCSummary)
	r.Delete("/clear-all-data", clearAllData)
	r.Get("/export/pdf", exportScheduleCPDF)
	r.Get("/export/csv", exportScheduleCSV)

	// Serve frontend static files
	frontendSubFS, err := fs.Sub(frontendFS, "frontend")
	if err != nil {
		log.Fatal("Failed to create frontend sub filesystem:", err)
	}
	r.Handle("/*", http.FileServer(http.FS(frontendSubFS)))

	// Open browser automatically
	go func() {
		time.Sleep(2 * time.Second)
		fmt.Println("🌐 Opening browser at http://localhost:8080")
		// Note: This would need platform-specific code to actually open browser
		// For now, just print the URL
	}()

	fmt.Println("🚀 Schedule C Calculator starting on :8080")
	fmt.Printf("📊 Database: %s\n", dbPath)
	fmt.Printf("📁 Uploads: %s\n", uploadsDir)
	fmt.Println("✅ Open http://localhost:8080 in your browser")

	log.Fatal(http.ListenAndServe(":8080", r))
}

func createTables() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS transactions (
			id TEXT PRIMARY KEY,
			date DATETIME NOT NULL,
			vendor TEXT NOT NULL,
			amount REAL NOT NULL,
			card TEXT NOT NULL,
			category TEXT DEFAULT '',
			purpose TEXT DEFAULT '',
			expensable BOOLEAN DEFAULT false,
			type TEXT DEFAULT 'expense',
			source_file TEXT DEFAULT '',
			schedule_c_line INTEGER DEFAULT 0,
			is_business BOOLEAN DEFAULT true
		)`,
		`CREATE TABLE IF NOT EXISTS csv_files (
			id TEXT PRIMARY KEY,
			filename TEXT NOT NULL,
			uploaded DATETIME DEFAULT CURRENT_TIMESTAMP,
			source TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS deduction_data (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			business_miles REAL DEFAULT 0,
			home_office_sqft REAL DEFAULT 0,
			total_home_sqft REAL DEFAULT 0,
			use_simplified BOOLEAN DEFAULT true,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
	}

	for _, query := range queries {
		_, err := db.Exec(query)
		if err != nil {
			return fmt.Errorf("failed to execute query: %v", err)
		}
	}

	// Initialize deduction data if empty
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM deduction_data").Scan(&count)
	if err != nil {
		return err
	}
	if count == 0 {
		_, err = db.Exec("INSERT INTO deduction_data (business_miles, home_office_sqft, total_home_sqft, use_simplified) VALUES (0, 0, 0, true)")
		if err != nil {
			return err
		}
	}

	return nil
}

func healthCheck(w http.ResponseWriter, r *http.Request) {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM transactions").Scan(&count)
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"status":            "healthy",
		"database":          "connected",
		"transaction_count": count,
		"timestamp":         time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func uploadCSV(w http.ResponseWriter, r *http.Request) {
	// Handle file upload
	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Failed to get file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	source := r.FormValue("source")
	if source == "" {
		source = "expenses"
	}

	// Generate unique file ID
	fileID := uuid.New().String()

	// Get executable directory for uploads
	execPath, _ := os.Executable()
	execDir := filepath.Dir(execPath)
	uploadsDir := filepath.Join(execDir, "uploads")

	filename := fmt.Sprintf("%s_%s", fileID, header.Filename)
	filepath := filepath.Join(uploadsDir, filename)

	// Save file
	dst, err := os.Create(filepath)
	if err != nil {
		http.Error(w, "Failed to create file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	_, err = io.Copy(dst, file)
	if err != nil {
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}

	// Parse CSV
	parsedData, err := parseCSVFile(filepath, fileID, source, header.Filename)
	if err != nil {
		http.Error(w, "Failed to parse CSV: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Save transactions to database
	err = saveTransactions(parsedData.Transactions)
	if err != nil {
		http.Error(w, "Failed to save transactions", http.StatusInternalServerError)
		return
	}

	response := UploadResponse{
		Success:            true,
		Message:            "File uploaded and processed successfully",
		FileID:             fileID,
		Filename:           header.Filename,
		TempPath:           filepath,
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
		return nil, err
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		return nil, err
	}

	if len(records) < 2 {
		return nil, fmt.Errorf("CSV file must have at least a header and one data row")
	}

	headers := records[0]
	var transactions []Transaction
	paymentsExcluded := 0

	cardName := extractCardName(originalFilename)

	for i, record := range records[1:] {
		if len(record) < 3 {
			continue
		}

		transaction, isPayment, err := parseTransactionRecord(record, headers, "generic", fileID, source, cardName)
		if err != nil {
			log.Printf("Error parsing record %d: %v", i+1, err)
			continue
		}

		if isPayment {
			paymentsExcluded++
			continue
		}

		transactions = append(transactions, *transaction)
	}

	return &ParsedCSVData{
		Transactions:     transactions,
		PaymentsExcluded: paymentsExcluded,
		ParsedCount:      len(transactions),
	}, nil
}

func parseTransactionRecord(record []string, headers []string, format, fileID, source, cardName string) (*Transaction, bool, error) {
	transaction := Transaction{
		ID:         uuid.New().String(),
		Card:       cardName,
		SourceFile: fileID,
		Type:       "expense",
		IsBusiness: true,
	}

	// Basic parsing - assumes Date, Description, Amount columns
	if len(record) >= 3 {
		// Date
		if date, err := parseDate(record[0]); err == nil {
			transaction.Date = date
		} else {
			transaction.Date = time.Now()
		}

		// Vendor/Description
		transaction.Vendor = strings.TrimSpace(record[1])

		// Amount
		amountStr := strings.TrimSpace(record[2])
		amountStr = strings.ReplaceAll(amountStr, "$", "")
		amountStr = strings.ReplaceAll(amountStr, ",", "")
		if amount, err := strconv.ParseFloat(amountStr, 64); err == nil {
			transaction.Amount = amount
		}
	}

	return &transaction, false, nil
}

func extractCardName(filename string) string {
	// Extract card name from filename
	name := filepath.Base(filename)
	name = strings.TrimSuffix(name, filepath.Ext(name))
	return name
}

func parseDate(dateStr string) (time.Time, error) {
	layouts := []string{
		"2006-01-02",
		"01/02/2006",
		"1/2/2006",
		"2006/01/02",
		"Jan 2, 2006",
		"January 2, 2006",
	}

	for _, layout := range layouts {
		if t, err := time.Parse(layout, dateStr); err == nil {
			return t, nil
		}
	}

	return time.Time{}, fmt.Errorf("unable to parse date: %s", dateStr)
}

func saveTransactions(transactions []Transaction) error {
	for _, tx := range transactions {
		query := `INSERT INTO transactions (id, date, vendor, amount, card, category, purpose, expensable, type, source_file, schedule_c_line, is_business)
				  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		_, err := db.Exec(query, tx.ID, tx.Date, tx.Vendor, tx.Amount, tx.Card, tx.Category, tx.Purpose, tx.Expensable, tx.Type, tx.SourceFile, tx.ScheduleCLine, tx.IsBusiness)
		if err != nil {
			return err
		}
	}
	return nil
}

func getTransactions(w http.ResponseWriter, r *http.Request) {
	unlimited := r.URL.Query().Get("unlimited")
	pageSize := 50
	if unlimited == "true" {
		pageSize = 999999
	}

	query := `SELECT id, date, vendor, amount, card, category, purpose, expensable, type, source_file, schedule_c_line, is_business
			  FROM transactions ORDER BY date DESC LIMIT ?`

	rows, err := db.Query(query, pageSize)
	if err != nil {
		http.Error(w, "Failed to fetch transactions", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var transactions []Transaction
	for rows.Next() {
		var tx Transaction
		err := rows.Scan(&tx.ID, &tx.Date, &tx.Vendor, &tx.Amount, &tx.Card,
			&tx.Category, &tx.Purpose, &tx.Expensable, &tx.Type, &tx.SourceFile, &tx.ScheduleCLine, &tx.IsBusiness)
		if err != nil {
			continue
		}
		transactions = append(transactions, tx)
	}

	// Get total count
	var totalCount int
	db.QueryRow("SELECT COUNT(*) FROM transactions").Scan(&totalCount)

	response := map[string]interface{}{
		"transactions": transactions,
		"count":        len(transactions),
		"total":        totalCount,
		"page":         1,
		"pageSize":     pageSize,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func toggleBusinessStatus(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TransactionID string `json:"transaction_id"`
		IsBusiness    bool   `json:"is_business"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	_, err := db.Exec("UPDATE transactions SET is_business = ? WHERE id = ?", req.IsBusiness, req.TransactionID)
	if err != nil {
		http.Error(w, "Failed to update transaction", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func toggleAllBusinessStatus(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IsBusiness bool `json:"is_business"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	_, err := db.Exec("UPDATE transactions SET is_business = ?", req.IsBusiness)
	if err != nil {
		http.Error(w, "Failed to update transactions", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func updateVehicleDeduction(w http.ResponseWriter, r *http.Request) {
	var req struct {
		BusinessMiles float64 `json:"business_miles"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	_, err := db.Exec("UPDATE deduction_data SET business_miles = ?, updated_at = CURRENT_TIMESTAMP", req.BusinessMiles)
	if err != nil {
		http.Error(w, "Failed to update vehicle deduction", http.StatusInternalServerError)
		return
	}

	mileageRate := 0.67 // 2024 IRS rate
	deduction := req.BusinessMiles * mileageRate

	response := map[string]interface{}{
		"success":           true,
		"business_miles":    req.BusinessMiles,
		"mileage_rate":      mileageRate,
		"vehicle_deduction": deduction,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func updateHomeOfficeDeduction(w http.ResponseWriter, r *http.Request) {
	var req struct {
		HomeOfficeSqft float64 `json:"home_office_sqft"`
		TotalHomeSqft  float64 `json:"total_home_sqft"`
		UseSimplified  bool    `json:"use_simplified"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	_, err := db.Exec("UPDATE deduction_data SET home_office_sqft = ?, total_home_sqft = ?, use_simplified = ?, updated_at = CURRENT_TIMESTAMP",
		req.HomeOfficeSqft, req.TotalHomeSqft, req.UseSimplified)
	if err != nil {
		http.Error(w, "Failed to update home office deduction", http.StatusInternalServerError)
		return
	}

	var deduction float64
	if req.UseSimplified {
		// Simplified method: $5 per sq ft, max 300 sq ft
		sqft := req.HomeOfficeSqft
		if sqft > 300 {
			sqft = 300
		}
		deduction = sqft * 5
	} else {
		// Actual expense method - just return the percentage
		if req.TotalHomeSqft > 0 {
			deduction = req.HomeOfficeSqft / req.TotalHomeSqft * 100 // percentage
		}
	}

	response := map[string]interface{}{
		"success":               true,
		"home_office_sqft":      req.HomeOfficeSqft,
		"total_home_sqft":       req.TotalHomeSqft,
		"use_simplified":        req.UseSimplified,
		"home_office_deduction": deduction,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func getDeductions(w http.ResponseWriter, r *http.Request) {
	var businessMiles, homeOfficeSqft, totalHomeSqft float64
	var useSimplified bool
	var updatedAt string

	err := db.QueryRow("SELECT business_miles, home_office_sqft, total_home_sqft, use_simplified, updated_at FROM deduction_data ORDER BY id DESC LIMIT 1").
		Scan(&businessMiles, &homeOfficeSqft, &totalHomeSqft, &useSimplified, &updatedAt)
	if err != nil {
		http.Error(w, "Failed to get deductions", http.StatusInternalServerError)
		return
	}

	mileageRate := 0.67
	vehicleDeduction := businessMiles * mileageRate

	var homeOfficeDeduction float64
	if useSimplified {
		sqft := homeOfficeSqft
		if sqft > 300 {
			sqft = 300
		}
		homeOfficeDeduction = sqft * 5
	}

	response := map[string]interface{}{
		"success":               true,
		"business_miles":        businessMiles,
		"vehicle_deduction":     vehicleDeduction,
		"home_office_sqft":      homeOfficeSqft,
		"total_home_sqft":       totalHomeSqft,
		"use_simplified":        useSimplified,
		"home_office_deduction": homeOfficeDeduction,
		"updated_at":            updatedAt,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func getScheduleCSummary(w http.ResponseWriter, r *http.Request) {
	// Get all business transactions
	rows, err := db.Query("SELECT amount, schedule_c_line FROM transactions WHERE is_business = true AND type = 'expense'")
	if err != nil {
		http.Error(w, "Failed to get transactions", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	scheduleC := make(map[string]float64)
	totalExpenses := 0.0

	for rows.Next() {
		var amount float64
		var line int
		rows.Scan(&amount, &line)

		totalExpenses += amount

		lineKey := fmt.Sprintf("line%d", line)
		scheduleC[lineKey] += amount
	}

	// Get deductions
	var businessMiles, homeOfficeSqft float64
	var useSimplified bool
	db.QueryRow("SELECT business_miles, home_office_sqft, use_simplified FROM deduction_data ORDER BY id DESC LIMIT 1").
		Scan(&businessMiles, &homeOfficeSqft, &useSimplified)

	mileageRate := 0.67
	vehicleDeduction := businessMiles * mileageRate

	var homeOfficeDeduction float64
	if useSimplified {
		sqft := homeOfficeSqft
		if sqft > 300 {
			sqft = 300
		}
		homeOfficeDeduction = sqft * 5
	}

	// Add deductions to schedule C
	scheduleC["line9_car_truck"] = vehicleDeduction
	scheduleC["line30_home_office"] = homeOfficeDeduction

	totalExpenses += vehicleDeduction + homeOfficeDeduction

	response := map[string]interface{}{
		"success":          true,
		"schedule_c":       scheduleC,
		"tax_year":         2024,
		"calculation_date": time.Now().Format("2006-01-02 15:04:05"),
		"summary": map[string]interface{}{
			"total_expenses":   totalExpenses,
			"net_profit_loss":  -totalExpenses, // Assuming no income for simplicity
			"vehicle_miles":    businessMiles,
			"home_office_sqft": homeOfficeSqft,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func clearAllData(w http.ResponseWriter, r *http.Request) {
	queries := []string{
		"DELETE FROM transactions",
		"DELETE FROM csv_files",
		"UPDATE deduction_data SET business_miles = 0, home_office_sqft = 0, total_home_sqft = 0, use_simplified = true",
	}

	for _, query := range queries {
		_, err := db.Exec(query)
		if err != nil {
			http.Error(w, "Failed to clear data", http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

func exportScheduleCPDF(w http.ResponseWriter, r *http.Request) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.AddPage()
	pdf.SetFont("Arial", "B", 16)
	pdf.Cell(40, 10, "Schedule C Summary")
	pdf.Ln(12)

	// Add some basic content
	pdf.SetFont("Arial", "", 12)
	pdf.Cell(40, 10, "Generated: "+time.Now().Format("2006-01-02 15:04:05"))

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "attachment; filename=schedule_c.pdf")

	err := pdf.Output(w)
	if err != nil {
		http.Error(w, "Failed to generate PDF", http.StatusInternalServerError)
	}
}

func exportScheduleCSV(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=schedule_c_transactions.csv")

	writer := csv.NewWriter(w)
	defer writer.Flush()

	// Write header
	writer.Write([]string{"Date", "Vendor", "Amount", "Category", "Business"})

	// Write transaction data
	rows, err := db.Query("SELECT date, vendor, amount, category, is_business FROM transactions ORDER BY date DESC")
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var date, vendor, category string
		var amount float64
		var isBusiness bool

		rows.Scan(&date, &vendor, &amount, &category, &isBusiness)

		businessStr := "Personal"
		if isBusiness {
			businessStr = "Business"
		}

		writer.Write([]string{
			date,
			vendor,
			fmt.Sprintf("%.2f", amount),
			category,
			businessStr,
		})
	}
}
