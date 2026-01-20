/**
 * Type definitions for the Schedule C Calculator.
 * These types mirror the Go backend models in pkg/models/transaction.go
 * Keep these in sync when making changes to either file.
 */

/**
 * Transaction represents a financial transaction from a bank or credit card statement.
 * This is the canonical definition used across the application.
 */
export interface Transaction {
  id: string
  date: string // ISO format "2024-12-31T00:00:00Z"
  vendor: string
  amount: number
  card: string // Card name extracted from filename (e.g., "Chase Card", "Amex Purple")
  category: string
  purpose: string
  expensable: boolean
  type: TransactionType
  source_file: string // Reference to the uploaded file ID
  schedule_c_line: number // IRS Schedule C line number (8-27, or 30 for home office)
  is_business: boolean // User toggle for business vs personal expense
  sort_category?: string // Normalized category for sorting
  sort_business?: string // "Business" or "Personal" for sorting
  created_at?: string
}

/**
 * Transaction type constants
 */
export type TransactionType = "income" | "expense" | "refund" | "uncategorized"

/**
 * CSVFile represents an uploaded CSV file record
 */
export interface CSVFile {
  id: string
  filename: string
  uploaded: string
  source: "income" | "expenses" | "both"
  created_at?: string
}

/**
 * DeductionData stores vehicle mileage and home office deduction information
 */
export interface DeductionData {
  id?: number
  business_miles: number
  home_office_sqft: number
  total_home_sqft: number
  use_simplified: boolean
  updated_at?: string
  // Calculated fields (returned by API)
  vehicle_deduction?: number
  home_office_deduction?: number
}

/**
 * VendorRule defines automatic categorization rules for vendors
 */
export interface VendorRule {
  id: number
  vendor: string
  type: "income" | "expense"
  expensable: boolean
  category: string
  schedule_c_line: number
  created_at?: string
}

/**
 * ScheduleCCategory represents an IRS Schedule C expense category
 */
export interface ScheduleCCategory {
  id: number
  name: string
  line_number: number
  description: string
}

/**
 * ExpenseClassification is returned by the LLM categorization service
 */
export interface ExpenseClassification {
  category: string
  schedule_c_line: number
  expensable: boolean
  purpose: string
  confidence: number
}

/**
 * UploadResponse is returned after a successful CSV upload
 */
export interface UploadResponse {
  success: boolean
  message: string
  file_id: string
  filename: string
  temp_path?: string
  source: string
  transactions_parsed: number
  payments_excluded: number
}

/**
 * Summary contains Schedule C calculation results
 */
export interface Summary {
  success: boolean
  tax_year: number
  calculation_date: string
  summary: {
    total_expenses: number
    expense_transactions: number
    income_transactions: number
    uncategorized_transactions: number
    net_profit_loss: number
    gross_receipts: number
    vehicle_miles?: number
    home_office_sqft?: number
  }
  schedule_c: { [key: string]: number }
}

/**
 * BusinessSummary provides an overview of business vs personal transactions
 */
export interface BusinessSummary {
  business_income: number
  business_expenses: number
  net_profit_loss: number
  business_income_transactions: number
  business_expense_transactions: number
  personal_transactions: number
}

/**
 * UploadedFile represents a file that has been uploaded
 */
export interface UploadedFile {
  name: string
  size: number
  uploadDate: string
  transactionCount: number
  id: string
}

/**
 * API Error response structure
 */
export interface APIError {
  success: false
  error: {
    code: string
    message: string
    details?: string
  }
}

/**
 * Partial success response for bulk operations
 */
export interface PartialSuccessResponse {
  success: boolean
  message: string
  processed: number
  failed: number
  failed_ids?: string[]
  errors?: string[]
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number
  pageSize: number
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * IRS Constants - keep in sync with backend pkg/config/config.go
 */
export const IRS_RATES = {
  // 2024 IRS standard mileage rate
  STANDARD_MILEAGE_RATE: 0.67,
  // Simplified home office rate per sq ft
  SIMPLIFIED_HOME_OFFICE_RATE: 5.0,
  // Maximum sq ft for simplified method
  MAX_SIMPLIFIED_HOME_OFFICE_SQFT: 300,
  // Tax year
  TAX_YEAR: 2024,
} as const

/**
 * Schedule C line number mappings
 */
export const SCHEDULE_C_LINES: { [category: string]: number } = {
  "Advertising": 8,
  "Car and truck": 9,
  "Commissions and fees": 10,
  "Contractors": 11,
  "Depletion": 12,
  "Depreciation": 13,
  "Employee benefit programs": 14,
  "Insurance": 15,
  "Interest paid": 16,
  "Legal fees and professional services": 17,
  "Office expenses": 18,
  "Pension and profit-sharing": 19,
  "Rent and lease": 20,
  "Repairs and maintenance": 21,
  "Supplies": 22,
  "Taxes and licenses": 23,
  "Meals": 24,
  "Travel expenses": 25,
  "Utilities": 26,
  "Other business expenses": 27,
  "Home office": 30,
}

/**
 * Valid Schedule C line range
 */
export const MIN_SCHEDULE_C_LINE = 8
export const MAX_SCHEDULE_C_LINE = 27
export const HOME_OFFICE_LINE = 30

/**
 * Check if a line number is valid for Schedule C
 */
export function isValidScheduleCLine(line: number): boolean {
  return (line >= MIN_SCHEDULE_C_LINE && line <= MAX_SCHEDULE_C_LINE) || line === HOME_OFFICE_LINE
}

/**
 * Calculate mileage deduction
 */
export function calculateMileageDeduction(miles: number): number {
  return miles * IRS_RATES.STANDARD_MILEAGE_RATE
}

/**
 * Calculate simplified home office deduction
 */
export function calculateSimplifiedHomeOfficeDeduction(sqft: number): number {
  const cappedSqft = Math.min(sqft, IRS_RATES.MAX_SIMPLIFIED_HOME_OFFICE_SQFT)
  return cappedSqft * IRS_RATES.SIMPLIFIED_HOME_OFFICE_RATE
}
