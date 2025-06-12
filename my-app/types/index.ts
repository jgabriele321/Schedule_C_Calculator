export interface Transaction {
  id: string
  date: string // ISO format "2024-12-31T00:00:00Z"
  vendor: string
  amount: number
  card: string // "Chase Card", "Amex Purple", "Amex Gold"
  category: string
  purpose: string
  expensable: boolean
  type: "expense" | "income"
  source_file: string
  schedule_c_line: number
  is_business: boolean // User toggle for business vs personal expense
}

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
  }
  schedule_c: { [key: string]: number }
}

export interface UploadedFile {
  name: string
  size: number
  uploadDate: string
  transactionCount: number
  id: string
}
