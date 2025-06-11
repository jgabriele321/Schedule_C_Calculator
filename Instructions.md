# INSTRUCTIONS.md

## ✪ Project Title
**Schedule C Desktop Tax Assistant – Backend Specification**

## 🌟 Purpose
This backend service will support a desktop application for small business owners, freelancers, and single-member LLCs to:
- Upload CSV files from credit cards or bank accounts
- Automatically classify income and business expenses
- Identify recurring vendors and high-value transactions
- Collect vehicle mileage and home office deduction data
- Output IRS-compliant **Schedule C (Form 1040)**
- Generate final export as a PDF and/or a CSV summary

---

## 🔹 Architecture

```
Electron App (Node.js frontend)
   └── Connects via HTTP to:
       Go Backend API Server (runs locally on localhost:8080)
          ├── CSV Parser & Normalizer
          ├── Transaction Classifier
          ├── Deduction Input Manager
          ├── Vendor Rule Engine
          ├── Schedule C Calculator
          └── Export Services (PDF + CSV)
```

Electron launches the Go backend automatically. Go serves a REST API for transaction classification and export.

---

## 📂 Data Structures

### `Transaction`
```go
type Transaction struct {
  ID         string
  Date       time.Time
  Vendor     string
  Amount     float64
  Card       string
  Category   string
  Purpose    string
  Expensable bool
  Type       string // "income", "expense", "refund", "uncategorized"
  SourceFile string // reference to CSVFile.ID
}
```

### `CSVFile`
```go
type CSVFile struct {
  ID        string
  Filename  string
  Uploaded  time.Time
  Source    string // "income", "expenses", "both"
}
```

### `DeductionData`
```go
type DeductionData struct {
  BusinessMiles   int
  HomeOfficeSqft  int
  TotalHomeSqft   int
  UseSimplified   bool
}
```

### `VendorRule`
```go
type VendorRule struct {
  Vendor     string
  Type       string // income or expense
  Expensable bool
  Category   string
}
```

---

## 🔗 API Endpoints

| Method | Endpoint          | Description |
|--------|-------------------|-------------|
| POST   | `/upload-csv`     | Accept CSV file + income/expense tag |
| GET    | `/transactions`   | Return all transactions with filters |
| POST   | `/classify`       | Update classification of transactions |
| POST   | `/vehicle`        | Submit mileage deduction details |
| POST   | `/home-office`    | Submit home office deduction details |
| POST   | `/vendor-rule`    | Save rules for recurring vendors |
| GET    | `/summary`        | Return Schedule C lines 1–31 |
| GET    | `/export/pdf`     | Generate and return Schedule C PDF |
| GET    | `/export/csv`     | Export itemized CSV for accountant |

---

## ✅ Implementation Plan (Highly Detailed)

### ⬛ Phase 1: Set Up Project and CSV Upload

1. Initialize Go project with router (e.g., `chi` or `net/http`)
2. Add endpoint `/upload-csv` with `multipart/form-data`
3. Accept a user-selected toggle value (`income`, `expenses`, `both`)
4. Parse CSV files using `encoding/csv`
5. Normalize to `Transaction` structs
6. Assign unique ID to each transaction
7. Store transactions in memory (for now) by file ID

#### Testing:
- Use test CSVs from multiple credit cards
- Verify successful parsing for different formats
- Confirm that transaction `Type` matches file-level toggle
- Log first 10 parsed transactions for visual inspection

---

### ⬛ Phase 2: Transaction Review Logic

1. Create `/transactions` endpoint
2. Support query params:
   - `?highValue=true&threshold=XXX`
   - `?recurring=true`
   - `?type=income|expense`
3. Track vendor frequency for recurring detection
4. Add `/classify` endpoint to update `Category`, `Purpose`, and `Expensable`

#### Testing:
- Manually upload 3+ CSVs
- Confirm correct grouping into high-value and recurring
- Send POST to `/classify` and validate update
- Simulate user changing threshold to see dynamic filter behavior

---

### ⬛ Phase 3: Vendor Rule Engine

1. Create `/vendor-rule` POST endpoint
2. Accept vendor rules:
   ```json
   {
     "vendor": "v0.dev",
     "type": "expense",
     "expensable": true,
     "category": "Software Subscriptions"
   }
   ```
3. Match vendor strings in new transactions and apply rules
4. Reapply vendor rules on demand or re-import

#### Testing:
- Upload 3 files with the same recurring vendor
- Set rule in first upload, verify it's auto-applied to next two
- Log classification source (user vs rule)

---

### ⬛ Phase 4: Deduction Modules

1. Add `/vehicle` and `/home-office` POST endpoints
2. Accept and store values into memory (or JSON for persistence)
3. Business mileage × 0.67 = car/truck expense
4. Home office:
   - Simplified: `sqft * $5`
   - Actual: `total expenses * (homeOfficeSqft / totalSqft)`

#### Testing:
- Enter mileage, verify deduction = miles × 0.67
- Toggle simplified/home method and test formula output
- Log deduction values and attach to session ID or JSON file

---

### ⬛ Phase 5: Schedule C Calculation

1. Sum all `Type: income` transactions = **Line 1**
2. Group all `Type: expense` by category = **Lines 8–27**
3. Include mileage deduction in **Line 9**
4. Include home office in **Line 30**
5. Calculate **Line 31 = Line 7 − Line 28**
6. Respond with JSON object like:
   ```json
   {
     "line1": 25000,
     "line9": 670,
     "line18": 320,
     "line30": 1500,
     "line31": 18000
   }
   ```

#### Testing:
- Seed app with synthetic data for each major line
- Verify line item logic matches IRS structure
- Compare outputs to IRS Schedule C instructions

---

### ⬛ Phase 6: Export Engine

1. Implement `/export/pdf`:
   - Use `gofpdf` or template filling tool
   - Output final Schedule C layout with calculated values
2. Implement `/export/csv`:
   - Include all transactions with `Expensable == true`
   - Include a summary table for each line item

#### Testing:
- Generate PDF and manually compare to Schedule C form
- Open CSV in Excel and confirm line totals
- Spot-check category mappings for accuracy

---

### ⬛ Phase 7: Packaging

1. Compile Go backend to binary (macOS + Windows)
2. Use Electron to call backend using `child_process.spawn()`
3. Ensure port `localhost:8080` is started and ready
4. Bundle with Electron Builder for `.exe` and `.dmg`

#### Testing:
- Run on clean machine with no dev tools
- Confirm Electron app can communicate with Go binary
- Run end-to-end: upload CSV → review → export

---

## 🎉 Final Deliverables

- Fully working Go backend with:
  - REST API server
  - CSV import logic
  - Rule-based classification
  - Deduction modules
  - Schedule C calculator
  - PDF and CSV exporters
- Binary executable for Electron
- Tested on Mac and Windows

---

Let me know if you want the code scaffolding for each phase, starting with `main.go` and `/upload-csv` route.
