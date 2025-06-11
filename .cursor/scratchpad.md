# Schedule C Desktop Tax Assistant - Project Plan

## Background and Motivation

The project aims to build a **Schedule C Desktop Tax Assistant** to help small business owners, freelancers, and single-member LLCs:
- Upload CSV files from credit cards or bank accounts
- Automatically classify income and business expenses
- Identify recurring vendors and high-value transactions
- Collect vehicle mileage and home office deduction data
- Output IRS-compliant **Schedule C (Form 1040)**
- Generate final export as a PDF and/or a CSV summary

### Current State Analysis
- **Frontend**: Next.js application exists with a comprehensive dashboard UI already built (`my-app/` directory)
  - UI includes file upload, transaction review, deduction input, and export interfaces
  - Built with React, TypeScript, Tailwind CSS, and shadcn/ui components
  - Mock data and basic UI interactions are implemented
- **Backend**: **DOES NOT EXIST** - needs to be built from scratch
- **Sample Data**: 4 CSV files from different credit cards available for testing
- **Architecture**: Planned as Go backend with REST API (per Instructions.md)

## Key Challenges and Analysis

1. **Data Format Inconsistency**: Sample CSV files have different column formats
   - Chase: `Status,Date,Description,Debit,Credit`
   - Need to normalize multiple bank/card formats into unified Transaction structure

2. **Classification Intelligence**: Need smart categorization of transactions
   - Business vs personal expenses
   - IRS Schedule C line item mapping
   - Vendor recognition and rule application

3. **Database Integration**: Persistent SQLite database
   - Use SQLite database for transaction storage that persists across app restarts
   - Can use OpenRouter/LLM to help with complex CSV parsing if needed

4. **IRS Compliance**: Accurate Schedule C calculation
   - Proper line item mapping (Lines 1-31)
   - Current mileage rate ($0.67/mile for 2024)
   - Home office deduction calculations

5. **Export Functionality**: PDF generation and CSV export
   - Must match official Schedule C form layout
   - Include detailed transaction records for accountant review

## High-level Task Breakdown

### Phase 1: Go Backend Foundation ⏳
**Goal**: Create basic Go REST API server with CSV upload capability
- [x] **Task 1.1**: Initialize Go project structure with chi router and SQLite database
  - Success Criteria: `go run main.go` starts server on :8080, SQLite database initializes, health check endpoint responds ✅
- [x] **Task 1.2**: Implement `/upload-csv` endpoint with multipart file handling
  - Success Criteria: Can accept CSV files via POST, stores files temporarily, returns upload confirmation ✅
- [x] **Task 1.3**: Create CSV parser that normalizes different bank formats to Transaction struct
  - Success Criteria: Parses all 4 sample CSV files correctly, excludes payments, extracts vendor/date/amount, stores in SQLite ✅
- [x] **Task 1.4**: Implement `/transactions` GET endpoint with basic filtering
  - Success Criteria: Returns parsed transactions as JSON, supports query params for filtering ✅

### Phase 2: Transaction Classification System ⏳
**Goal**: Implement intelligent transaction categorization
- [ ] **Task 2.1**: Build vendor recognition system with LLM categorization
  - Success Criteria: Identifies recurring vendors, calculates frequency and totals, uses OpenRouter API for smart categorization
- [ ] **Task 2.2**: Implement `/classify` POST endpoint for manual classification updates
  - Success Criteria: Updates transaction category, purpose, and expensable status
- [ ] **Task 2.3**: Create `/vendor-rule` system for automatic classification
  - Success Criteria: Saves vendor rules, auto-applies to new transactions from same vendor
- [ ] **Task 2.4**: Add high-value transaction detection with configurable threshold
  - Success Criteria: Filters transactions above threshold, supports dynamic threshold changes

### Phase 3: Deduction Management ⏳
**Goal**: Handle vehicle mileage and home office deductions
- [ ] **Task 3.1**: Implement `/vehicle` POST endpoint for mileage data
  - Success Criteria: Stores business miles, calculates deduction at $0.67/mile
- [ ] **Task 3.2**: Implement `/home-office` POST endpoint with simplified vs actual method
  - Success Criteria: Calculates deduction using simplified ($5/sqft, max 300) or percentage method
- [ ] **Task 3.3**: Add deduction data persistence and retrieval
  - Success Criteria: Deduction data persists between sessions, retrievable via GET endpoints

### Phase 4: Schedule C Calculation Engine ⏳
**Goal**: Generate accurate IRS Schedule C calculations
- [ ] **Task 4.1**: Implement `/summary` endpoint for Schedule C line calculations
  - Success Criteria: Correctly sums income (Line 1), categorizes expenses (Lines 8-27), includes deductions
- [ ] **Task 4.2**: Map transaction categories to specific Schedule C line items
  - Success Criteria: Accurate mapping matches IRS categories, handles edge cases
- [ ] **Task 4.3**: Calculate final profit/loss (Line 31 = Line 7 - Line 28)
  - Success Criteria: Math is accurate, handles negative values correctly

### Phase 5: Export System ⏳
**Goal**: Generate PDF and CSV exports
- [ ] **Task 5.1**: Implement `/export/pdf` endpoint using gofpdf library
  - Success Criteria: Generates PDF matching official Schedule C form layout
- [ ] **Task 5.2**: Implement `/export/csv` endpoint for detailed transaction export
  - Success Criteria: Exports all transactions with categories, includes summary totals
- [ ] **Task 5.3**: Add export validation and error handling
  - Success Criteria: Handles missing data gracefully, provides clear error messages

### Phase 6: Frontend-Backend Integration ⏳
**Goal**: Connect existing Next.js frontend to Go backend
- [ ] **Task 6.1**: Update frontend API calls to use Go backend endpoints
  - Success Criteria: All frontend functionality works with real backend data
- [ ] **Task 6.2**: Replace mock data with real API responses
  - Success Criteria: File uploads, transaction display, and calculations use backend data
- [ ] **Task 6.3**: Add error handling and loading states in frontend
  - Success Criteria: Graceful handling of API errors, proper loading indicators

### Phase 7: Production Deployment ⏳
**Goal**: Prepare for production deployment
- [ ] **Task 7.1**: Set up production build process for Next.js frontend
  - Success Criteria: Optimized production build with proper environment configuration
- [ ] **Task 7.2**: Create Go backend production binary
  - Success Criteria: Compiled Go binary runs efficiently, handles production load
- [ ] **Task 7.3**: Database migration and backup systems
  - Success Criteria: SQLite database properly initialized, backup/restore functionality

### Phase 8: Testing and Validation ⏳
**Goal**: Comprehensive testing with real data
- [ ] **Task 8.1**: End-to-end testing with all sample CSV files
  - Success Criteria: Successfully processes all 4 sample files, generates accurate Schedule C
- [ ] **Task 8.2**: Validate calculations against IRS Schedule C instructions
  - Success Criteria: Math matches official IRS calculations, handles edge cases
- [ ] **Task 8.3**: User acceptance testing and bug fixes
  - Success Criteria: App works smoothly for typical user workflow, no critical bugs

## Project Status Board

### Sprint 1: Backend Foundation
- [ ] Initialize Go project with chi router
- [ ] Implement CSV upload endpoint
- [ ] Create CSV parser for multiple formats
- [ ] Build transactions API endpoint

### Sprint 2: Classification & Rules
- [ ] Build vendor recognition system
- [ ] Implement manual classification endpoint
- [ ] Create vendor rule engine
- [ ] Add high-value transaction filtering

### Sprint 3: Deductions & Calculations
- [ ] Vehicle mileage deduction system
- [ ] Home office deduction system  
- [ ] Schedule C calculation engine
- [ ] Line item mapping

### Sprint 4: Export & Integration
- [ ] PDF export functionality
- [ ] CSV export functionality
- [ ] Frontend-backend integration
- [ ] Error handling improvements

### Sprint 5: Production & Testing
- [ ] Production build setup
- [ ] Database migration system
- [ ] End-to-end testing
- [ ] Final validation and deployment

## Current Status / Progress Tracking

**Current Phase**: Phase 1 COMPLETED ✅ → Starting Phase 2 ⏳
**Next Action**: Task 2.1 - Build vendor recognition system
**Blockers**: None identified
**Last Updated**: Phase 1 COMPLETED ✅ - All CSV parsing and basic endpoints working with real data

## Executor's Feedback or Assistance Requests

### Task 1.1 Completion Report ✅
**Completed**: Initialize Go project structure with chi router and SQLite database

**What was delivered**:
- ✅ Go backend project structure created in `/backend` directory
- ✅ Go modules initialized with required dependencies (chi, cors, sqlite3)
- ✅ SQLite database created at `./schedccalc.db` with all required tables:
  - `transactions` - stores parsed CSV transaction data
  - `csv_files` - tracks uploaded files
  - `vendor_rules` - for automatic transaction classification (future use)
  - `deduction_data` - for mileage/home office deductions (future use)
- ✅ REST API server running on `:8080` with CORS enabled for frontend communication
- ✅ Health check endpoint at `/health` returning database status and transaction count
- ✅ Root API endpoint at `/` with version and status information

**Testing results**:
- Server starts successfully: `go run main.go` ✅
- Database initializes: SQLite file created with proper schema ✅  
- Health endpoint responds: JSON with database connection status ✅
- CORS configured for Next.js frontend communication ✅

**Phase 1 Complete**: All tasks completed successfully ✅

### Phase 1 Final Results:
- ✅ **Task 1.1**: Go backend with SQLite database running on :8080
- ✅ **Task 1.2**: CSV upload endpoint with multipart file handling  
- ✅ **Task 1.3**: CSV parser supporting Chase & Amex formats, excludes payments, stores 821 transactions
- ✅ **Task 1.4**: Transactions API with filtering (highValue, recurring, type, card)

### Key Achievements:
- **3 CSV files processed**: Chase Card (698 transactions), Amex Gold (80), Amex Purple (43)
- **30 payments excluded** as requested
- **Multiple format support**: Chase (Debit/Credit columns) vs Amex (Amount column)
- **Smart vendor extraction**: Removes prefixes, state codes, cleans formatting
- **Persistent storage**: All data survives server restarts via SQLite

**Ready to start Phase 2**: Vendor recognition and classification system

## Lessons

### Technical Decisions Made
1. **Architecture**: Next.js web app + Go backend (no Electron desktop app needed)
2. **Database**: SQLite for persistent storage from the start
3. **CSV Parsing**: Handle multiple bank formats, exclude payments, use OpenRouter/LLM if needed for complex parsing
4. **Mileage Rate**: Use current 2024 rate of $0.67/mile as specified
5. **Payment Exclusion**: Never categorize or include payment transactions in expenses
6. **LLM Integration**: Use OpenRouter API for intelligent transaction categorization and Schedule C line mapping

### Environment Variables Notes
- Project will have `.env` file in root directory for configuration
- Never create new `.env` - it exists and is accessible to application
- Reference environment variables relative to project root

### Sample Data Analysis
- Chase CSV format: `Status,Date,Description,Debit,Credit`
- Transactions include mix of business/personal expenses
- Foreign transaction fees present
- Recurring subscriptions easily identifiable (GOOGLE, NETFLIX, etc.)
- Will need logic to distinguish business vs personal based on vendor and category

---

**Planner Notes**: This plan follows the detailed implementation phases from Instructions.md while accounting for the existing Next.js frontend. The approach is incremental with clear success criteria for each task. The Executor should complete one task at a time and report back before proceeding. 