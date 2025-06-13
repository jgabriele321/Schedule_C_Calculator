"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
  Calculator,
  Upload,
  BarChart3,
  Receipt,
  Tags,
  Download,
  Cloud,
  Check,
  AlertCircle,
  Search,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  FileText,
  CreditCard,
  X,
  Loader2,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  ChevronDown
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { api } from "@/lib/api"
import { formatCurrency, formatDate, formatFileSize, getCategoryColor, getTypeColor } from "@/lib/utils"
import type { Transaction, Summary, UploadedFile } from "@/types"

export function Dashboard() {
  const [activeTab, setActiveTab] = useState("upload")
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasData, setHasData] = useState(false)

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [sourceType, setSourceType] = useState<string>("expenses")
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [recentUploads, setRecentUploads] = useState<UploadedFile[]>([])

  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCard, setSelectedCard] = useState<string>("all")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [totalTransactions, setTotalTransactions] = useState(0)

  // Sorting state
  const [sortBy, setSortBy] = useState<"amount" | "date" | "vendor">("amount")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc") // Default: highest amounts first

  // Business toggle state
  const [allBusinessSelected, setAllBusinessSelected] = useState(false)

  // Business summary state
  const [businessSummary, setBusinessSummary] = useState<any>(null)
  const [isCalculating, setIsCalculating] = useState(false)

  // Toggle loading state
  const [toggleLoading, setToggleLoading] = useState<string | null>(null)

  // Recurring transactions state
  const [recurringTransactions, setRecurringTransactions] = useState<any[]>([])
  const [recurringLoading, setRecurringLoading] = useState(false)
  const [recurringToggleLoading, setRecurringToggleLoading] = useState<string | null>(null)
  const [expandedMerchants, setExpandedMerchants] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Load saved tab from localStorage
    const savedTab = localStorage.getItem("scheduleC-activeTab")
    if (savedTab && hasData) {
      setActiveTab(savedTab)
    }

    checkForExistingData()
  }, [hasData])



  useEffect(() => {
    // Save tab to localStorage
    localStorage.setItem("scheduleC-activeTab", activeTab)
  }, [activeTab])

  const checkForExistingData = async () => {
    try {
      const summaryData = await api.get("/summary")
      if (summaryData.success && summaryData.summary.expense_transactions > 0) {
        setHasData(true)
        setSummary(summaryData)
        setActiveTab("overview")
      }
    } catch {
      // No data exists, stay on upload tab
      setHasData(false)
    }
  }

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Build query parameters
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      })

      // Add filters if they're set
      if (searchTerm) params.append('search', searchTerm)
      if (selectedCard !== 'all') params.append('card', selectedCard)
      if (selectedType !== 'all') params.append('type', selectedType)
      if (selectedCategory !== 'all') params.append('category', selectedCategory)

      const data = await api.get(`/transactions?${params.toString()}`)
      setTransactions(data.transactions || [])
      setTotalTransactions(data.total || 0)
      
      // Update summary if available
      if (data.summary) {
        setSummary(prev => prev ? {
          ...prev,
          summary: {
            ...prev.summary,
            ...data.summary
          }
        } : null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions")
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, searchTerm, selectedCard, selectedType, selectedCategory])

  useEffect(() => {
    // Load transactions when transactions tab is activated
    if (activeTab === "transactions" && hasData) {
      loadTransactions()
    }
  }, [activeTab, hasData, loadTransactions])

  const loadSummary = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.get("/summary")
      setSummary(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load summary")
    } finally {
      setLoading(false)
    }
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      validateAndSetFile(file)
    }
  }, [])

  const validateAndSetFile = (file: File) => {
    setUploadError(null)

    // Validate file type
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setUploadError("Please select a CSV file")
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File size must be less than 10MB")
      return
    }

    setSelectedFile(file)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    try {
      setUploading(true)
      setUploadError(null)

      await api.uploadCSV(selectedFile, sourceType)

      setUploadSuccess(true)
      setSelectedFile(null)
      setHasData(true)

      // Add to recent uploads
      const newUpload: UploadedFile = {
        id: Date.now().toString(),
        name: selectedFile.name,
        size: selectedFile.size,
        uploadDate: new Date().toISOString(),
        transactionCount: 0, // Would come from API response
      }
      setRecentUploads((prev) => [newUpload, ...prev.slice(0, 4)])

      // Redirect to overview after successful upload
      setTimeout(() => {
        setActiveTab("overview")
        setUploadSuccess(false)
        loadSummary()
      }, 2000)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  // Update effect dependencies to include filters
  useEffect(() => {
    if (hasData && activeTab === "transactions") {
      loadTransactions()
      // Also check overall business status for master toggle
      checkOverallBusinessStatus()
    }
  }, [currentPage, pageSize, searchTerm, selectedCard, selectedType, selectedCategory, hasData, activeTab, loadTransactions])

  // Separate effect to reset to page 1 when filters change (but not when page changes)
  useEffect(() => {
    if (hasData && activeTab === "transactions" && currentPage !== 1) {
      setCurrentPage(1)
    }
  }, [searchTerm, selectedCard, selectedType, selectedCategory, hasData, activeTab])

  // Load recurring transactions when recurring tab is active
  useEffect(() => {
    if (hasData && activeTab === "recurring") {
      loadRecurringTransactions()
    }
  }, [hasData, activeTab])

  const filteredTransactions = transactions

  const uniqueCards = Array.from(new Set((transactions || []).map((t) => t.card)))
  const uniqueCategories = Array.from(new Set((transactions || []).map((t) => t.category)))

  // Toggle handler functions (optimized for performance)
  const handleToggleBusiness = async (transactionId: string, isBusiness: boolean) => {
    // Immediate optimistic update for better UX
    setTransactions(prev => 
      prev.map(t => 
        t.id === transactionId ? { ...t, is_business: isBusiness } : t
      )
    )
    
    try {
      setToggleLoading(transactionId)
      await api.toggleBusiness(transactionId, isBusiness)
      // Success - keep the optimistic update and refresh master toggle state
      checkOverallBusinessStatus()
    } catch (error) {
      console.error("Failed to toggle business status:", error)
      // Revert on error
      setTransactions(prev => 
        prev.map(t => 
          t.id === transactionId ? { ...t, is_business: !isBusiness } : t
        )
      )
    } finally {
      setToggleLoading(null)
    }
  }

  const calculateBusinessSummary = async () => {
    setIsCalculating(true)
    try {
      // Load all transactions to get accurate business/personal split
      const allTransactionsData = await api.get("/transactions?unlimited=true")
      const allTransactions = allTransactionsData.transactions || []
      
      const businessTransactions = allTransactions.filter((t: any) => t.is_business)
      const personalTransactions = allTransactions.filter((t: any) => !t.is_business)
      
      const businessExpenses = businessTransactions
        .filter((t: any) => t.type === 'expense')
        .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0)
      
      const businessIncome = businessTransactions
        .filter((t: any) => t.type === 'income')
        .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0)
      
      const personalExpenses = personalTransactions
        .filter((t: any) => t.type === 'expense')
        .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0)
      
      setBusinessSummary({
        business_expenses: businessExpenses,
        business_income: businessIncome,
        business_transactions: businessTransactions.length,
        personal_transactions: personalTransactions.length,
        net_profit_loss: businessIncome - businessExpenses,
        personal_expenses: personalExpenses,
        total_transactions: allTransactions.length
      })
    } catch (error) {
      console.error("Failed to calculate business summary:", error)
    } finally {
      setIsCalculating(false)
    }
  }

  // Check overall database business status for master toggle
  const checkOverallBusinessStatus = async () => {
    try {
      // Load all transactions to check overall business status
      const allTransactionsData = await api.get("/transactions?unlimited=true")
      const allTransactions = allTransactionsData.transactions || []
      
      // Check if ALL transactions are marked as business
      const allAreBusiness = allTransactions.length > 0 && allTransactions.every((t: any) => t.is_business)
      setAllBusinessSelected(allAreBusiness)
    } catch (error) {
      console.error("Failed to check overall business status:", error)
    }
  }

  const handleToggleAllBusiness = async () => {
    const newState = !allBusinessSelected
    
    try {
      setToggleLoading("all")
      // Call API to toggle ALL transactions in database (no idList = all transactions)
      await api.toggleAllBusiness(newState, {})
      
      // After successful database update, reload current page to reflect changes
      await loadTransactions()
      
      // Update the master toggle state
      setAllBusinessSelected(newState)
    } catch (error) {
      console.error("Failed to toggle all business status:", error)
    } finally {
      setToggleLoading(null)
    }
  }

  // Load recurring transactions
  const loadRecurringTransactions = async () => {
    setRecurringLoading(true)
    try {
      const data = await api.get("/transactions?recurring=true&pageSize=1000")
      setRecurringTransactions(data.transactions || [])
    } catch (error) {
      console.error("Failed to load recurring transactions:", error)
    } finally {
      setRecurringLoading(false)
    }
  }

  // Toggle all recurring transactions
  const handleToggleAllRecurring = async (isBusiness: boolean) => {
    try {
      setRecurringToggleLoading("all")
      
      // Get all recurring transaction IDs
      const recurringIds = recurringTransactions.map(t => t.id)
      
      // Call API to toggle all recurring transactions
      await api.toggleAllBusiness(isBusiness, { idList: recurringIds })
      
      // Reload recurring transactions to reflect changes
      await loadRecurringTransactions()
      
      // Also refresh main transactions if on that tab
      if (activeTab === "transactions") {
        await loadTransactions()
      }
      
      // Update overall business status
      await checkOverallBusinessStatus()
    } catch (error) {
      console.error("Failed to toggle all recurring transactions:", error)
    } finally {
      setRecurringToggleLoading(null)
    }
  }

  // Handle individual recurring transaction toggle
  const handleRecurringToggleBusiness = async (transactionId: string, isBusiness: boolean) => {
    // Immediate optimistic update for better UX
    setRecurringTransactions(prev => 
      prev.map(t => 
        t.id === transactionId ? { ...t, is_business: isBusiness } : t
      )
    )
    
    try {
      setRecurringToggleLoading(transactionId)
      await api.toggleBusiness(transactionId, isBusiness)
      
      // Reload recurring transactions to reflect changes in grouping
      await loadRecurringTransactions()
      
      // Update overall business status
      await checkOverallBusinessStatus()
    } catch (error) {
      console.error("Failed to toggle recurring transaction business status:", error)
      // Revert on error
      setRecurringTransactions(prev => 
        prev.map(t => 
          t.id === transactionId ? { ...t, is_business: !isBusiness } : t
        )
      )
    } finally {
      setRecurringToggleLoading(null)
    }
  }

  const renderUpload = () => (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white">Upload CSV Files</h1>
        <p className="text-lg text-gray-400">Import your bank statements and credit card transactions</p>
      </div>

      {/* Upload Card */}
      <Card className="border border-gray-700 bg-gray-800/50 backdrop-blur-sm">
        <CardContent className="p-8">
          <div
            className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              dragActive
                ? "border-blue-500 bg-blue-900/20"
                : selectedFile
                  ? "border-green-500 bg-green-900/20"
                  : "border-gray-600 hover:border-blue-500 hover:bg-blue-900/10"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            <div className="space-y-4">
              {selectedFile ? (
                <>
                  <Check className="h-12 w-12 text-green-400 mx-auto" />
                  <div>
                    <p className="text-lg font-medium text-green-300">{selectedFile.name}</p>
                    <p className="text-sm text-green-400">{formatFileSize(selectedFile.size)}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedFile(null)
                    }}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                </>
              ) : (
                <>
                  <Cloud className="h-12 w-12 text-gray-400 mx-auto" />
                  <div>
                    <p className="text-lg font-medium text-gray-200">
                      Drag and drop your CSV files here, or click to browse
                    </p>
                    <p className="text-sm text-gray-400">CSV files only, max 10MB</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {uploadError && (
            <Alert className="mt-4 border-red-900 bg-red-900/20">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-300">{uploadError}</AlertDescription>
            </Alert>
          )}

          {uploadSuccess && (
            <Alert className="mt-4 border-green-900 bg-green-900/20">
              <Check className="h-4 w-4 text-green-400" />
              <AlertDescription className="text-green-300">
                File uploaded successfully! Redirecting to overview...
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Source Type Selection */}
      <Card className="border-gray-700 bg-gray-800/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-gray-200">Transaction Type</CardTitle>
          <CardDescription className="text-gray-400">
            Select what type of transactions this CSV contains
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-6">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="sourceType"
                value="expenses"
                checked={sourceType === "expenses"}
                onChange={(e) => setSourceType(e.target.value)}
                className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600"
              />
              <span className="text-sm font-medium text-gray-300">Expenses</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="sourceType"
                value="income"
                checked={sourceType === "income"}
                onChange={(e) => setSourceType(e.target.value)}
                className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600"
              />
              <span className="text-sm font-medium text-gray-300">Income</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="sourceType"
                value="both"
                checked={sourceType === "both"}
                onChange={(e) => setSourceType(e.target.value)}
                className="w-4 h-4 text-blue-500 bg-gray-700 border-gray-600"
              />
              <span className="text-sm font-medium text-gray-300">Both</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Supported Formats */}
      <Card className="border-gray-700 bg-gray-800/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-gray-200">Supported Formats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Check className="h-4 w-4 text-green-400" />
              <span className="text-sm text-gray-300">Chase Bank CSV exports</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="h-4 w-4 text-green-400" />
              <span className="text-sm text-gray-300">American Express CSV exports</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="h-4 w-4 text-green-400" />
              <span className="text-sm text-gray-300">Generic bank CSV files</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Button */}
      <div className="text-center">
        <Button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          size="lg"
          className="px-8 bg-blue-600 hover:bg-blue-700 text-white"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload and Process CSV
            </>
          )}
        </Button>
      </div>

      {/* Recent Uploads */}
      {recentUploads.length > 0 && (
        <Card className="border-gray-700 bg-gray-800/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-gray-200">Recent Uploads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentUploads.map((upload) => (
                <div key={upload.id} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-sm text-gray-200">{upload.name}</p>
                      <p className="text-xs text-gray-400">
                        {formatDate(upload.uploadDate)} • {formatFileSize(upload.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                      Re-process
                    </Button>
                    <Button variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )

  const renderOverview = () => {
    if (!hasData) {
      return (
        <div className="text-center py-12">
          <Upload className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-200 mb-2">No data available</h3>
          <p className="text-gray-400 mb-4">Upload your CSV files to see your financial overview</p>
          <Button onClick={() => setActiveTab("upload")} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </Button>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {/* Calculate Button */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-200">Business Overview</h2>
            <p className="text-sm text-gray-400">Click Calculate to update totals based on your business selections</p>
          </div>
          <Button 
            onClick={calculateBusinessSummary}
            disabled={isCalculating}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isCalculating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Calculating...
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4 mr-2" />
                Calculate Overview
              </>
            )}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-gray-700 bg-gradient-to-br from-gray-800 to-gray-900 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">Business Expenses</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-400">
                {businessSummary ? formatCurrency(businessSummary.business_expenses) : "--"}
              </div>
              <p className="text-xs text-gray-500">
                {businessSummary ? `${businessSummary.business_transactions} business transactions` : "Click Calculate"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-700 bg-gradient-to-br from-gray-800 to-gray-900 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">Personal Expenses</CardTitle>
              <Receipt className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-400">
                {businessSummary ? formatCurrency(businessSummary.personal_expenses) : "--"}
              </div>
              <p className="text-xs text-gray-500">
                {businessSummary ? `${businessSummary.personal_transactions} personal transactions` : "Click Calculate"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-700 bg-gradient-to-br from-gray-800 to-gray-900 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">Total Transactions</CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-100">
                {businessSummary ? businessSummary.total_transactions.toLocaleString() : "--"}
              </div>
              <p className="text-xs text-gray-500">
                {businessSummary ? 
                  `${businessSummary.business_transactions} business, ${businessSummary.personal_transactions} personal` : 
                  "Click Calculate"
                }
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-700 bg-gradient-to-br from-gray-800 to-gray-900 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">Business Net</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  businessSummary && businessSummary.net_profit_loss >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {businessSummary ? formatCurrency(businessSummary.net_profit_loss) : "--"}
              </div>
              <p className="text-xs text-gray-500">
                Income - Business Expenses
              </p>
            </CardContent>
          </Card>
        </div>

        {businessSummary && businessSummary.business_transactions === 0 && (
          <Alert className="border-amber-900 bg-amber-900/20">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <AlertDescription className="text-amber-300">
              No business transactions selected. Go to the Transactions tab and mark transactions as business expenses to see your Schedule C overview.
            </AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  const renderRecurring = () => {
    const allRecurringBusiness = recurringTransactions.length > 0 && recurringTransactions.every(t => t.is_business)
    const allRecurringPersonal = recurringTransactions.length > 0 && recurringTransactions.every(t => !t.is_business)

    // Group transactions by merchant/vendor
    const merchantGroups = recurringTransactions.reduce((acc: any, transaction) => {
      // Use vendor as merchant identifier, clean it up
      const merchant = transaction.vendor || transaction.description || 'Unknown Merchant'
      if (!acc[merchant]) {
        acc[merchant] = {
          merchant,
          transactions: [],
          totalAmount: 0,
          businessCount: 0,
          personalCount: 0,
          allBusiness: true,
          allPersonal: true
        }
      }
      
      acc[merchant].transactions.push(transaction)
      acc[merchant].totalAmount += Math.abs(transaction.amount)
      
      if (transaction.is_business) {
        acc[merchant].businessCount++
        acc[merchant].allPersonal = false
      } else {
        acc[merchant].personalCount++
        acc[merchant].allBusiness = false
      }
      
      return acc
    }, {})

    const sortedMerchants = Object.values(merchantGroups).sort((a: any, b: any) => b.transactions.length - a.transactions.length)

    const toggleMerchant = (merchant: string) => {
      const newExpanded = new Set(expandedMerchants)
      if (newExpanded.has(merchant)) {
        newExpanded.delete(merchant)
      } else {
        newExpanded.add(merchant)
      }
      setExpandedMerchants(newExpanded)
    }

    const toggleMerchantBusiness = async (merchantData: any, isBusiness: boolean) => {
      try {
        setRecurringToggleLoading(merchantData.merchant)
        
        // Get all transaction IDs for this merchant
        const merchantIds = merchantData.transactions.map((t: any) => t.id)
        
        // Call API to toggle all transactions for this merchant
        await api.toggleAllBusiness(isBusiness, { idList: merchantIds })
        
        // Reload recurring transactions to reflect changes
        await loadRecurringTransactions()
        
        // Also refresh main transactions if on that tab
        if (activeTab === "transactions") {
          await loadTransactions()
        }
        
        // Update overall business status
        await checkOverallBusinessStatus()
      } catch (error) {
        console.error(`Failed to toggle merchant ${merchantData.merchant}:`, error)
      } finally {
        setRecurringToggleLoading(null)
      }
    }

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Recurring Merchants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-100">{sortedMerchants.length}</div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Total Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-100">{recurringTransactions.length}</div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Business Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-400">
                {recurringTransactions.filter(t => t.is_business).length}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Monthly Impact</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-100">
                ${recurringTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0).toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bulk Actions */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-100">Bulk Actions</CardTitle>
            <CardDescription className="text-gray-400">
              Mark all recurring transactions as business or personal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-4">
              <Button
                onClick={() => handleToggleAllRecurring(true)}
                disabled={recurringToggleLoading === "all" || allRecurringBusiness}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {recurringToggleLoading === "all" ? (
                  <Loader2 className="h-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Mark All as Business
              </Button>
              
              <Button
                onClick={() => handleToggleAllRecurring(false)}
                disabled={recurringToggleLoading === "all" || allRecurringPersonal}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                {recurringToggleLoading === "all" ? (
                  <Loader2 className="h-4 animate-spin mr-2" />
                ) : (
                  <X className="h-4 w-4 mr-2" />
                )}
                Mark All as Personal
              </Button>

              <Button
                onClick={loadRecurringTransactions}
                disabled={recurringLoading}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                {recurringLoading ? (
                  <Loader2 className="h-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recurring Merchants Table */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-100">Recurring Merchants</CardTitle>
            <CardDescription className="text-gray-400">
              Merchants grouped by frequency. ✅ Checked = Business • ⬜ Unchecked = Personal
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recurringLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-400">Loading recurring transactions...</span>
              </div>
            ) : sortedMerchants.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <RefreshCw className="h-8 w-8 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400 font-medium">No recurring transactions found</p>
                  <p className="text-gray-500 text-sm">Upload more data to identify recurring patterns</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedMerchants.map((merchantData: any) => (
                  <div key={merchantData.merchant} className="border border-gray-700 rounded-lg">
                    {/* Merchant Header Row */}
                    <div className="flex items-center justify-between p-4 hover:bg-gray-700/30">
                      <div className="flex items-center space-x-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleMerchant(merchantData.merchant)}
                          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-200"
                        >
                          {expandedMerchants.has(merchantData.merchant) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                        <div>
                          <div className="font-medium text-gray-100">{merchantData.merchant}</div>
                          <div className="text-sm text-gray-400">
                            {merchantData.transactions.length} transactions • ${merchantData.totalAmount.toFixed(2)} total
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <div className="text-sm text-gray-400">
                          {merchantData.businessCount > 0 && (
                            <span className="text-blue-400">{merchantData.businessCount} business</span>
                          )}
                          {merchantData.businessCount > 0 && merchantData.personalCount > 0 && (
                            <span className="text-gray-500"> • </span>
                          )}
                          {merchantData.personalCount > 0 && (
                            <span className="text-gray-400">{merchantData.personalCount} personal</span>
                          )}
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            onClick={() => toggleMerchantBusiness(merchantData, true)}
                            disabled={recurringToggleLoading === merchantData.merchant || merchantData.allBusiness}
                            className="h-7 px-2 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                          >
                            {recurringToggleLoading === merchantData.merchant ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Business"
                            )}
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleMerchantBusiness(merchantData, false)}
                            disabled={recurringToggleLoading === merchantData.merchant || merchantData.allPersonal}
                            className="h-7 px-2 border-gray-600 text-gray-300 hover:bg-gray-700 text-xs"
                          >
                            {recurringToggleLoading === merchantData.merchant ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Personal"
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Transaction Details */}
                    {expandedMerchants.has(merchantData.merchant) && (
                      <div className="border-t border-gray-700 bg-gray-800/50">
                        <div className="p-4">
                          <div className="space-y-2">
                            {merchantData.transactions.map((transaction: any) => (
                              <div key={transaction.id} className="flex items-center justify-between py-2 px-3 bg-gray-700/30 rounded">
                                <div className="flex items-center space-x-3">
                                  <div className="text-sm text-gray-300">
                                    {new Date(transaction.date).toLocaleDateString()}
                                  </div>
                                  <div className="text-sm text-gray-100 max-w-xs truncate">
                                    {transaction.vendor || transaction.description || 'Unknown'}
                                  </div>
                                  <div className={`text-sm font-medium ${transaction.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                                    {transaction.type === 'income' ? '+' : '-'}${Math.abs(transaction.amount).toFixed(2)}
                                  </div>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    checked={transaction.is_business}
                                    onCheckedChange={(checked) => handleRecurringToggleBusiness(transaction.id, !!checked)}
                                    disabled={recurringToggleLoading === transaction.id}
                                    className="bg-gray-700 border-gray-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                  />
                                  <span className={`text-xs font-medium ${transaction.is_business ? 'text-blue-400' : 'text-gray-400'}`}>
                                    {transaction.is_business ? 'Business' : 'Personal'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderTransactions = () => {
    return (
      <div className="space-y-6">
        {/* Filters and Search */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-100">Filters</CardTitle>
            <CardDescription className="text-gray-400">
              Filter and search your transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Search</label>
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Card</label>
                <select
                  value={selectedCard}
                  onChange={(e) => setSelectedCard(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Cards</option>
                  <option value="amex">Amex</option>
                  <option value="visa">Visa</option>
                  <option value="mastercard">Mastercard</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Types</option>
                  <option value="expense">Expenses</option>
                  <option value="income">Income</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Categories</option>
                  <option value="office">Office</option>
                  <option value="travel">Travel</option>
                  <option value="meals">Meals</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Master Toggle */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-100">Bulk Actions</CardTitle>
            <CardDescription className="text-gray-400">
              ✅ Checked = Business • ⬜ Unchecked = Personal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={allBusinessSelected}
                  onCheckedChange={handleToggleAllBusiness}
                  disabled={toggleLoading === "all"}
                  className="bg-gray-700 border-gray-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                />
                <span className="text-sm font-medium text-gray-300">
                  Mark All Database as Business
                </span>
              </div>
              {toggleLoading === "all" && (
                <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-100">Transactions</CardTitle>
            <CardDescription className="text-gray-400">
              Page {currentPage} of {Math.ceil(totalTransactions / pageSize)} • {totalTransactions} total transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-400">Loading transactions...</span>
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <Receipt className="h-8 w-8 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400 font-medium">No transactions found</p>
                  <p className="text-gray-500 text-sm">Try adjusting your filters or upload more data</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((transaction: any) => (
                  <div key={transaction.id} className="flex items-center justify-between py-3 px-4 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="text-sm text-gray-300">
                        {new Date(transaction.date).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-gray-100 max-w-xs truncate">
                        {transaction.vendor || transaction.description || 'Unknown'}
                      </div>
                      <div className={`text-sm font-medium ${transaction.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                        {transaction.type === 'income' ? '+' : '-'}${Math.abs(transaction.amount).toFixed(2)}
                      </div>
                      {transaction.category && (
                        <div className="text-xs px-2 py-1 bg-gray-600 text-gray-300 rounded">
                          {transaction.category}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={transaction.is_business}
                        onCheckedChange={(checked) => handleToggleBusiness(transaction.id, !!checked)}
                        disabled={toggleLoading === transaction.id}
                        className="bg-gray-700 border-gray-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      />
                      <span className={`text-xs font-medium ${transaction.is_business ? 'text-blue-400' : 'text-gray-400'}`}>
                        {transaction.is_business ? 'Business' : 'Personal'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalTransactions > pageSize && (
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalTransactions)} of {totalTransactions} transactions
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1 || loading}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    <ArrowUp className="h-4 w-4 mr-1 rotate-[-90deg]" />
                    Previous
                  </Button>
                  
                  <span className="text-sm text-gray-400">
                    Page {currentPage} of {Math.ceil(totalTransactions / pageSize)}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalTransactions / pageSize), prev + 1))}
                    disabled={currentPage >= Math.ceil(totalTransactions / pageSize) || loading}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    Next
                    <ArrowDown className="h-4 w-4 ml-1 rotate-[-90deg]" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  const renderCategories = () => {
    // Categories render logic would go here  
    return <div>Categories content</div>
  }

  const renderExport = () => {
    // Export render logic would go here
    return <div>Export content</div>
  }

  const renderContent = () => {
    if (error) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-4" />
            <p className="text-red-400 font-medium">Error loading data</p>
            <p className="text-gray-400 text-sm">{error}</p>
            <Button onClick={() => window.location.reload()} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white">
              Try Again
            </Button>
          </div>
        </div>
      )
    }

    switch (activeTab) {
      case "upload":
        return renderUpload()
      case "overview":
        return renderOverview()
      case "transactions":
        return renderTransactions()
      case "recurring":
        return renderRecurring()
      case "categories":
        return renderCategories()
      case "export":
        return renderExport()
      default:
        return renderUpload()
    }
  }

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <div className="w-56 bg-gray-800 border-r border-gray-700 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="p-4 border-b border-gray-700 bg-gradient-to-r from-gray-800 to-gray-900">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg">
              <Calculator className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-100">Schedule C</h2>
              <p className="text-xs text-gray-400">Assistant</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          <button
            onClick={() => setActiveTab("upload")}
            className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left transition-colors ${
              activeTab === "upload"
                ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md"
                : "text-gray-300 hover:bg-gray-700/50"
            }`}
          >
            <Upload className="h-4 w-4" />
            <span className="text-sm font-medium">Upload</span>
            {activeTab === "upload" && <ChevronRight className="h-3 w-3 ml-auto" />}
          </button>

          <button
            onClick={() => setActiveTab("overview")}
            className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left transition-colors ${
              activeTab === "overview"
                ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md"
                : "text-gray-300 hover:bg-gray-700/50"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span className="text-sm font-medium">Overview</span>
            {activeTab === "overview" && <ChevronRight className="h-3 w-3 ml-auto" />}
          </button>

          <button
            onClick={() => setActiveTab("transactions")}
            className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left transition-colors ${
              activeTab === "transactions"
                ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md"
                : "text-gray-300 hover:bg-gray-700/50"
            }`}
          >
            <Receipt className="h-4 w-4" />
            <span className="text-sm font-medium">Transactions</span>
            {activeTab === "transactions" && <ChevronRight className="h-3 w-3 ml-auto" />}
          </button>

          <button
            onClick={() => setActiveTab("recurring")}
            className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left transition-colors ${
              activeTab === "recurring"
                ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md"
                : "text-gray-300 hover:bg-gray-700/50"
            }`}
          >
            <RefreshCw className="h-4 w-4" />
            <span className="text-sm font-medium">Recurring</span>
            {activeTab === "recurring" && <ChevronRight className="h-3 w-3 ml-auto" />}
          </button>

          <button
            onClick={() => setActiveTab("categories")}
            className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left transition-colors ${
              activeTab === "categories"
                ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md"
                : "text-gray-300 hover:bg-gray-700/50"
            }`}
          >
            <Tags className="h-4 w-4" />
            <span className="text-sm font-medium">Categories</span>
            {activeTab === "categories" && <ChevronRight className="h-3 w-3 ml-auto" />}
          </button>

          <button
            onClick={() => setActiveTab("export")}
            className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left transition-colors ${
              activeTab === "export"
                ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md"
                : "text-gray-300 hover:bg-gray-700/50"
            }`}
          >
            <Download className="h-4 w-4" />
            <span className="text-sm font-medium">Export</span>
            {activeTab === "export" && <ChevronRight className="h-3 w-3 ml-auto" />}
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-gray-700 bg-gray-800 px-8 flex items-center sticky top-0 z-10">
          <div>
            <h1 className="text-lg font-semibold text-gray-100">
              {activeTab === "upload" && "Upload CSV Files"}
              {activeTab === "overview" && "Overview"}
              {activeTab === "transactions" && "Transactions"}
              {activeTab === "recurring" && "Recurring Transactions"}
              {activeTab === "categories" && "Categories"}
              {activeTab === "export" && "Export"}
            </h1>
            <p className="text-xs text-gray-400">
              {activeTab === "upload" && "Import your bank statements and credit card transactions"}
              {activeTab === "overview" && "Financial summary and key metrics"}
              {activeTab === "transactions" && "Review and manage your transactions"}
              {activeTab === "recurring" && "Manage recurring transactions and bulk actions"}
              {activeTab === "categories" && "Expense breakdown by category"}
              {activeTab === "export" && "Download reports and tax forms"}
            </p>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto px-8 py-6 bg-gradient-to-b from-gray-900 to-gray-950">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  )
}
