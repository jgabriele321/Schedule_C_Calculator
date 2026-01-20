// Package migrations provides database migration management for the Schedule C Calculator.
// It tracks schema versions and applies migrations in order.
package migrations

import (
	"database/sql"
	"fmt"
	"sort"
	"time"

	"schedccalc/pkg/logger"
)

// Migration represents a database migration
type Migration struct {
	Version     int
	Description string
	Up          func(*sql.Tx) error
	Down        func(*sql.Tx) error
}

// Migrator handles database migrations
type Migrator struct {
	db         *sql.DB
	migrations []Migration
}

// NewMigrator creates a new migrator instance
func NewMigrator(db *sql.DB) *Migrator {
	m := &Migrator{
		db:         db,
		migrations: getAllMigrations(),
	}
	return m
}

// getAllMigrations returns all available migrations
func getAllMigrations() []Migration {
	return []Migration{
		{
			Version:     1,
			Description: "Create initial tables",
			Up:          migrateV1Up,
			Down:        migrateV1Down,
		},
		{
			Version:     2,
			Description: "Add schedule_c_line column to transactions",
			Up:          migrateV2Up,
			Down:        migrateV2Down,
		},
		{
			Version:     3,
			Description: "Add is_business column to transactions",
			Up:          migrateV3Up,
			Down:        migrateV3Down,
		},
		{
			Version:     4,
			Description: "Add sortable columns to transactions",
			Up:          migrateV4Up,
			Down:        migrateV4Down,
		},
		{
			Version:     5,
			Description: "Create schedule_c_categories table",
			Up:          migrateV5Up,
			Down:        migrateV5Down,
		},
	}
}

// Initialize creates the migrations table if it doesn't exist
func (m *Migrator) Initialize() error {
	query := `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INTEGER PRIMARY KEY,
			description TEXT NOT NULL,
			applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`
	_, err := m.db.Exec(query)
	if err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}
	return nil
}

// CurrentVersion returns the current schema version
func (m *Migrator) CurrentVersion() (int, error) {
	var version int
	err := m.db.QueryRow("SELECT COALESCE(MAX(version), 0) FROM schema_migrations").Scan(&version)
	if err != nil {
		return 0, fmt.Errorf("failed to get current version: %w", err)
	}
	return version, nil
}

// MigrateUp applies all pending migrations
func (m *Migrator) MigrateUp() error {
	if err := m.Initialize(); err != nil {
		return err
	}

	currentVersion, err := m.CurrentVersion()
	if err != nil {
		return err
	}

	// Sort migrations by version
	sort.Slice(m.migrations, func(i, j int) bool {
		return m.migrations[i].Version < m.migrations[j].Version
	})

	applied := 0
	for _, migration := range m.migrations {
		if migration.Version <= currentVersion {
			continue
		}

		logger.Info("Applying migration", map[string]interface{}{
			"version":     migration.Version,
			"description": migration.Description,
		})

		tx, err := m.db.Begin()
		if err != nil {
			return fmt.Errorf("failed to begin transaction for migration %d: %w", migration.Version, err)
		}

		if err := migration.Up(tx); err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to apply migration %d (%s): %w", migration.Version, migration.Description, err)
		}

		// Record the migration
		_, err = tx.Exec(
			"INSERT INTO schema_migrations (version, description, applied_at) VALUES (?, ?, ?)",
			migration.Version, migration.Description, time.Now(),
		)
		if err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to record migration %d: %w", migration.Version, err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("failed to commit migration %d: %w", migration.Version, err)
		}

		applied++
		logger.Info("Migration applied successfully", map[string]interface{}{
			"version": migration.Version,
		})
	}

	if applied == 0 {
		logger.Info("Database is up to date", map[string]interface{}{
			"version": currentVersion,
		})
	} else {
		logger.Info("Migrations complete", map[string]interface{}{
			"applied": applied,
		})
	}

	return nil
}

// MigrateDown rolls back the last migration
func (m *Migrator) MigrateDown() error {
	currentVersion, err := m.CurrentVersion()
	if err != nil {
		return err
	}

	if currentVersion == 0 {
		logger.Info("No migrations to roll back", nil)
		return nil
	}

	// Find the migration to roll back
	var migration *Migration
	for i := range m.migrations {
		if m.migrations[i].Version == currentVersion {
			migration = &m.migrations[i]
			break
		}
	}

	if migration == nil {
		return fmt.Errorf("migration %d not found", currentVersion)
	}

	logger.Info("Rolling back migration", map[string]interface{}{
		"version":     migration.Version,
		"description": migration.Description,
	})

	tx, err := m.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	if err := migration.Down(tx); err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to roll back migration %d: %w", migration.Version, err)
	}

	_, err = tx.Exec("DELETE FROM schema_migrations WHERE version = ?", migration.Version)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to remove migration record: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit rollback: %w", err)
	}

	logger.Info("Migration rolled back successfully", map[string]interface{}{
		"version": migration.Version,
	})

	return nil
}

// Migration V1: Create initial tables
func migrateV1Up(tx *sql.Tx) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS transactions (
			id TEXT PRIMARY KEY,
			date DATETIME NOT NULL,
			vendor TEXT NOT NULL,
			amount REAL NOT NULL,
			card TEXT NOT NULL DEFAULT '',
			category TEXT DEFAULT 'uncategorized',
			purpose TEXT DEFAULT '',
			expensable BOOLEAN DEFAULT FALSE,
			type TEXT DEFAULT 'expense',
			source_file TEXT DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS csv_files (
			id TEXT PRIMARY KEY,
			filename TEXT NOT NULL,
			uploaded DATETIME DEFAULT CURRENT_TIMESTAMP,
			source TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS vendor_rules (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			vendor TEXT UNIQUE NOT NULL,
			type TEXT DEFAULT 'expense',
			expensable BOOLEAN DEFAULT TRUE,
			category TEXT DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS deduction_data (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			business_miles INTEGER DEFAULT 0,
			home_office_sqft INTEGER DEFAULT 0,
			total_home_sqft INTEGER DEFAULT 0,
			use_simplified BOOLEAN DEFAULT TRUE,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		// Initialize deduction data with defaults
		`INSERT OR IGNORE INTO deduction_data (id, business_miles, home_office_sqft, total_home_sqft, use_simplified) 
		 VALUES (1, 0, 0, 0, TRUE)`,
	}

	for _, query := range queries {
		if _, err := tx.Exec(query); err != nil {
			return fmt.Errorf("failed to execute query: %w", err)
		}
	}

	return nil
}

func migrateV1Down(tx *sql.Tx) error {
	queries := []string{
		"DROP TABLE IF EXISTS deduction_data",
		"DROP TABLE IF EXISTS vendor_rules",
		"DROP TABLE IF EXISTS csv_files",
		"DROP TABLE IF EXISTS transactions",
	}

	for _, query := range queries {
		if _, err := tx.Exec(query); err != nil {
			return fmt.Errorf("failed to execute query: %w", err)
		}
	}

	return nil
}

// Migration V2: Add schedule_c_line column
func migrateV2Up(tx *sql.Tx) error {
	_, err := tx.Exec("ALTER TABLE transactions ADD COLUMN schedule_c_line INTEGER DEFAULT 0")
	if err != nil {
		// Column might already exist
		return nil
	}
	
	_, err = tx.Exec("ALTER TABLE vendor_rules ADD COLUMN schedule_c_line INTEGER DEFAULT 0")
	return err
}

func migrateV2Down(tx *sql.Tx) error {
	// SQLite doesn't support DROP COLUMN, so we'd need to recreate the table
	// For simplicity, we'll leave the column in place
	return nil
}

// Migration V3: Add is_business column
func migrateV3Up(tx *sql.Tx) error {
	_, err := tx.Exec("ALTER TABLE transactions ADD COLUMN is_business BOOLEAN DEFAULT FALSE")
	return err
}

func migrateV3Down(tx *sql.Tx) error {
	return nil
}

// Migration V4: Add sortable columns
func migrateV4Up(tx *sql.Tx) error {
	queries := []string{
		"ALTER TABLE transactions ADD COLUMN sort_category TEXT DEFAULT ''",
		"ALTER TABLE transactions ADD COLUMN sort_business TEXT DEFAULT 'Personal'",
	}

	for _, query := range queries {
		tx.Exec(query) // Ignore errors for already existing columns
	}

	// Populate sortable columns
	updateQueries := []string{
		`UPDATE transactions 
		 SET sort_category = CASE
			 WHEN category = '' OR category IS NULL THEN 'zzz_uncategorized'
			 ELSE LOWER(category)
		 END
		 WHERE sort_category = '' OR sort_category IS NULL`,
		`UPDATE transactions 
		 SET sort_business = CASE
			 WHEN is_business = 1 THEN 'Business'
			 ELSE 'Personal'
		 END
		 WHERE sort_business = '' OR sort_business IS NULL`,
	}

	for _, query := range updateQueries {
		if _, err := tx.Exec(query); err != nil {
			return err
		}
	}

	return nil
}

func migrateV4Down(tx *sql.Tx) error {
	return nil
}

// Migration V5: Create schedule_c_categories table
func migrateV5Up(tx *sql.Tx) error {
	_, err := tx.Exec(`
		CREATE TABLE IF NOT EXISTS schedule_c_categories (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			line_number INTEGER NOT NULL,
			description TEXT NOT NULL
		)
	`)
	if err != nil {
		return err
	}

	// Insert default categories
	categories := []struct {
		Name        string
		LineNumber  int
		Description string
	}{
		{"Advertising", 8, "Advertising and marketing expenses"},
		{"Car and truck", 9, "Vehicle expenses for business use"},
		{"Commissions and fees", 10, "Commissions and fees paid"},
		{"Contractors", 11, "Contract labor and contractor expenses"},
		{"Insurance", 15, "Business insurance expenses"},
		{"Interest paid", 16, "Business interest payments"},
		{"Legal fees and professional services", 17, "Legal and professional services"},
		{"Meals", 24, "Business meals and entertainment"},
		{"Office expenses", 18, "Office supplies and expenses"},
		{"Other business expenses", 27, "Other miscellaneous business expenses"},
		{"Rent and lease", 20, "Rent or lease of business property and equipment"},
		{"Repairs and maintenance", 21, "Repairs and maintenance expenses"},
		{"Supplies", 22, "Business supplies and materials"},
		{"Taxes and licenses", 23, "Business taxes and licenses"},
		{"Travel expenses", 25, "Business travel expenses"},
		{"Utilities", 26, "Business utilities and communications"},
	}

	stmt, err := tx.Prepare("INSERT INTO schedule_c_categories (name, line_number, description) VALUES (?, ?, ?)")
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, cat := range categories {
		_, err = stmt.Exec(cat.Name, cat.LineNumber, cat.Description)
		if err != nil {
			return err
		}
	}

	return nil
}

func migrateV5Down(tx *sql.Tx) error {
	_, err := tx.Exec("DROP TABLE IF EXISTS schedule_c_categories")
	return err
}
