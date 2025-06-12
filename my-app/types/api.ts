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
}

export interface Summary {
  total_expenses: number
  total_income: number
  total_transactions: number
  business_categories: number
  net_profit_loss: number
  uncategorized_items: number
  categories: CategorySummary[]
}

export interface CategorySummary {
  name: string
  total: number
  percentage: number
  schedule_c_line: number
  top_vendors: string[]
}

export interface HealthCheck {
  status: string
  timestamp: string
}
