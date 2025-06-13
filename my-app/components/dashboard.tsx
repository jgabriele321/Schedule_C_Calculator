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
      const allTransactionsData = await api.get("/transactions?pageSize=10000")
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
      const allTransactionsData = await api.get("/transactions?pageSize=10000")
      const allTransactions = allTransactionsData.transactions || []
      
      if (allTransactions.length > 0) {
        const businessCount = allTransactions.filter((t: any) => t.is_business).length
        // Master toggle is "on" if ALL transactions in database are business
        setAllBusinessSelected(businessCount === allTransactions.length)
      } else {
        setAllBusinessSelected(false)
      }
    } catch (error) {
      console.error("Failed to check overall business status:", error)
      setAllBusinessSelected(false)
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

  const renderTransactions = () => {
    if (!hasData) {
      return (
        <div className="text-center py-12">
          <Receipt className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-200 mb-2">No transactions found</h3>
          <p className="text-gray-400 mb-4">Upload your CSV files to see your transactions</p>
          <Button onClick={() => setActiveTab("upload")} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </Button>
        </div>
      )
    }

    if (transactions.length === 0 && !loading) {
      loadTransactions()
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center space-x-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-700 text-gray-200 placeholder:text-gray-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={selectedCard} onValueChange={setSelectedCard}>
              <SelectTrigger className="w-[140px] bg-gray-800 border-gray-700 text-gray-200">
                <SelectValue placeholder="All Cards" />
              </SelectTrigger>
              <SelectContent className="bg-blue-900 border-blue-800 text-white [&>*]:bg-blue-900 [&>*]:text-white">
                <SelectItem value="all" className="focus:bg-blue-800 focus:text-white">All Cards</SelectItem>
                {uniqueCards.map((card) => (
                  <SelectItem key={card} value={card} className="focus:bg-blue-800 focus:text-white">
                    {card}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-[120px] bg-gray-800 border-gray-700 text-gray-200">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent className="bg-blue-900 border-blue-800 text-white [&>*]:bg-blue-900 [&>*]:text-white">
                <SelectItem value="all" className="focus:bg-blue-800 focus:text-white">All Types</SelectItem>
                <SelectItem value="expense" className="focus:bg-blue-800 focus:text-white">Expenses</SelectItem>
                <SelectItem value="income" className="focus:bg-blue-800 focus:text-white">Income</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[140px] bg-gray-800 border-gray-700 text-gray-200">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent className="bg-blue-900 border-blue-800 text-white [&>*]:bg-blue-900 [&>*]:text-white">
                <SelectItem value="all" className="focus:bg-blue-800 focus:text-white">All Categories</SelectItem>
                {uniqueCategories.map((category) => (
                  <SelectItem key={category} value={category} className="focus:bg-blue-800 focus:text-white">
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
              const [newSortBy, newSortOrder] = value.split('-') as ["amount" | "date" | "vendor", "asc" | "desc"]
              setSortBy(newSortBy)
              setSortOrder(newSortOrder)
            }}>
              <SelectTrigger className="w-[160px] bg-gray-800 border-gray-700 text-gray-200">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent className="bg-blue-900 border-blue-800 text-white [&>*]:bg-blue-900 [&>*]:text-white">
                <SelectItem value="amount-desc" className="focus:bg-blue-800 focus:text-white">Amount (High → Low)</SelectItem>
                <SelectItem value="amount-asc" className="focus:bg-blue-800 focus:text-white">Amount (Low → High)</SelectItem>
                <SelectItem value="date-desc" className="focus:bg-blue-800 focus:text-white">Date (Newest)</SelectItem>
                <SelectItem value="date-asc" className="focus:bg-blue-800 focus:text-white">Date (Oldest)</SelectItem>
                <SelectItem value="vendor-asc" className="focus:bg-blue-800 focus:text-white">Vendor (A → Z)</SelectItem>
                <SelectItem value="vendor-desc" className="focus:bg-blue-800 focus:text-white">Vendor (Z → A)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="border-gray-700 bg-gray-800/50 backdrop-blur-sm overflow-hidden h-[calc(100vh-280px)]">
          <CardContent className="p-0 h-full flex flex-col">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin mr-2 text-blue-400" />
                <span className="text-gray-300">Loading transactions...</span>
              </div>
            ) : (
              <div className="overflow-auto flex-1">
                <Table className="relative">
                  <TableHeader className="sticky top-0 bg-gray-700/50 z-10">
                    <TableRow className="border-gray-600">
                      <TableHead className="text-gray-400 py-3">
                        <div className="flex items-center space-x-1">
                          <span>Date</span>
                          {sortBy === "date" && (
                            sortOrder === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="text-gray-400 py-3">
                        <div className="flex items-center space-x-1">
                          <span>Vendor</span>
                          {sortBy === "vendor" && (
                            sortOrder === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="text-gray-400 text-right py-3">
                        <div className="flex items-center justify-end space-x-1">
                          <span>Amount</span>
                          {sortBy === "amount" && (
                            sortOrder === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="text-gray-400 py-3">Card</TableHead>
                      <TableHead className="text-gray-400 py-3">Category</TableHead>
                      <TableHead className="text-gray-400 py-3">Type</TableHead>
                      <TableHead className="text-gray-400 py-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs">Mark All Database</span>
                          <Checkbox
                            checked={allBusinessSelected}
                            onCheckedChange={() => handleToggleAllBusiness()}
                            disabled={toggleLoading === "all"}
                          />
                        </div>
                      </TableHead>
                      <TableHead className="text-gray-400 w-[50px] py-3"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((transaction) => (
                      <TableRow key={transaction.id} className="border-gray-700 hover:bg-gray-700/30">
                        <TableCell className="font-medium text-gray-300 py-4">{formatDate(transaction.date)}</TableCell>
                        <TableCell className="py-4 max-w-[200px]">
                          <div className="truncate">
                            <div className="font-medium text-gray-200 truncate">{transaction.vendor}</div>
                            {transaction.purpose && <div className="text-sm text-gray-400 mt-1 truncate">{transaction.purpose}</div>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-gray-200 py-4">
                          {formatCurrency(transaction.amount)}
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center">
                            <CreditCard className="mr-2 h-4 w-4 text-gray-400" />
                            <Badge variant="outline" className="border-gray-600 text-gray-300">
                              {transaction.card}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge className={getCategoryColor(transaction.category)}>{transaction.category}</Badge>
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge className={getTypeColor(transaction.type)}>{transaction.type}</Badge>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center justify-center">
                            <Checkbox
                              checked={transaction.is_business === true}
                              onCheckedChange={(checked: boolean) => handleToggleBusiness(transaction.id, checked)}
                              disabled={toggleLoading === transaction.id}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white border-gray-200 text-gray-900">
                              <DropdownMenuItem className="hover:bg-gray-100 focus:bg-gray-100">Edit</DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600 hover:bg-gray-100 focus:bg-gray-100">
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {/* Add pagination controls */}
                <div className="border-t border-gray-700 p-4 bg-gray-800/50">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-400">
                      Showing {Math.min((currentPage - 1) * pageSize + 1, totalTransactions)} to{" "}
                      {Math.min(currentPage * pageSize, totalTransactions)} of {totalTransactions} transactions
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="border-gray-600 text-gray-300 hover:bg-gray-700"
                      >
                        Previous
                      </Button>
                      <div className="text-sm text-gray-400">
                        Page {currentPage} of {Math.ceil(totalTransactions / pageSize)}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalTransactions / pageSize), p + 1))}
                        disabled={currentPage >= Math.ceil(totalTransactions / pageSize)}
                        className="border-gray-600 text-gray-300 hover:bg-gray-700"
                      >
                        Next
                      </Button>
                      <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(Number(value))}>
                        <SelectTrigger className="w-[110px] bg-gray-800 border-gray-700 text-gray-200">
                          <SelectValue placeholder="Page size" />
                        </SelectTrigger>
                        <SelectContent className="bg-blue-900 border-blue-800 text-white [&>*]:bg-blue-900 [&>*]:text-white">
                          <SelectItem value="10" className="focus:bg-blue-800 focus:text-white">10 per page</SelectItem>
                          <SelectItem value="25" className="focus:bg-blue-800 focus:text-white">25 per page</SelectItem>
                          <SelectItem value="50" className="focus:bg-blue-800 focus:text-white">50 per page</SelectItem>
                          <SelectItem value="100" className="focus:bg-blue-800 focus:text-white">100 per page</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderCategories = () => {
    if (!hasData) {
      return (
        <div className="text-center py-12">
          <Tags className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-200 mb-2">No categories available</h3>
          <p className="text-gray-400 mb-4">Upload your CSV files to see expense categories</p>
          <Button onClick={() => setActiveTab("upload")} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </Button>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-100">Expense Categories</h2>
          <p className="text-gray-400">Breakdown of your business expenses by category</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {summary?.schedule_c &&
            Object.entries(summary.schedule_c).map(([line, amount]) => (
              <Card
                key={line}
                className="border-gray-700 bg-gradient-to-br from-gray-800 to-gray-900 shadow-lg hover:shadow-xl transition-shadow"
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-gray-200">
                    <span className="capitalize">Schedule C Line {line}</span>
                    <Badge variant="outline" className="border-gray-600 text-gray-300">
                      Line {line}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-100">{formatCurrency(amount)}</div>
                  <Progress
                    value={Math.min((amount / (summary.summary.total_expenses || 1)) * 100, 100)}
                    className="mt-2 bg-gray-700"
                  />
                </CardContent>
              </Card>
            ))}
        </div>
      </div>
    )
  }

  const renderExport = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-100">Export Options</h2>
        <p className="text-gray-400">Download your tax data in various formats</p>
      </div>

      <Card className="border-gray-700 bg-gray-800/50 backdrop-blur-sm">
        <CardContent className="p-8">
          <div className="grid gap-6 md:grid-cols-2">
            <Button className="h-24 flex-col space-y-2 bg-blue-600 hover:bg-blue-700 text-white" disabled={!hasData}>
              <Download className="h-6 w-6" />
              <span>Download PDF Report</span>
            </Button>

            <Button
              variant="outline"
              className="h-24 flex-col space-y-2 border-gray-600 text-gray-300 hover:bg-gray-700"
              disabled={!hasData}
            >
              <Download className="h-6 w-6" />
              <span>Export Excel Spreadsheet</span>
            </Button>

            <Button
              variant="outline"
              className="h-24 flex-col space-y-2 border-gray-600 text-gray-300 hover:bg-gray-700"
              disabled={!hasData}
            >
              <Download className="h-6 w-6" />
              <span>Export CSV Data</span>
            </Button>

            <Button
              variant="outline"
              className="h-24 flex-col space-y-2 border-gray-600 text-gray-300 hover:bg-gray-700"
              disabled={!hasData}
            >
              <Download className="h-6 w-6" />
              <span>Generate Schedule C Form</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {!hasData && (
        <Alert className="border-gray-700 bg-gray-800/50">
          <AlertCircle className="h-4 w-4 text-gray-400" />
          <AlertDescription className="text-gray-300">
            Upload your transaction data first to enable export options.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )

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
      {/* Sidebar - Made narrower and collapsible */}
      <div className="w-56 bg-gray-800 border-r border-gray-700 flex flex-col flex-shrink-0">
        {/* Logo - More compact */}
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

        {/* Navigation - More compact */}
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

        {/* Footer - Removed to save space */}
      </div>

      {/* Main Content - Better spacing */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Sticky Header */}
        <header className="h-14 border-b border-gray-700 bg-gray-800 px-8 flex items-center sticky top-0 z-10">
          <div>
            <h1 className="text-lg font-semibold text-gray-100">
              {activeTab === "upload" && "Upload CSV Files"}
              {activeTab === "overview" && "Overview"}
              {activeTab === "transactions" && "Transactions"}
              {activeTab === "categories" && "Categories"}
              {activeTab === "export" && "Export"}
            </h1>
            <p className="text-xs text-gray-400">
              {activeTab === "upload" && "Import your bank statements and credit card transactions"}
              {activeTab === "overview" && "Financial summary and key metrics"}
              {activeTab === "transactions" && "Review and manage your transactions"}
              {activeTab === "categories" && "Expense breakdown by category"}
              {activeTab === "export" && "Download reports and tax forms"}
            </p>
          </div>
        </header>

        {/* Main content with better padding */}
        <main className="flex-1 overflow-auto px-8 py-6 bg-gradient-to-b from-gray-900 to-gray-950">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  )
}
