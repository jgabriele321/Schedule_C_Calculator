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
  ChevronRight,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  ChevronDown,
  Settings,
  Trash
} from "lucide-react"
import { Loader2 } from "lucide-react"
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
import { clientStorage } from "@/lib/client-storage"
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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [sourceType, setSourceType] = useState("expenses")
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: boolean}>({})
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
  const [sortBy, setSortBy] = useState<"amount" | "date" | "vendor" | "category" | "business">("amount")
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

  // IRS Categories state
  const [irsCategories, setIrsCategories] = useState<any[]>([])
  const [categoriesLoaded, setCategoriesLoaded] = useState(false)
  const [autoCategorizingTransactions, setAutoCategorizingTransactions] = useState<Set<string>>(new Set())
  const [autoCategorizingAll, setAutoCategorizingAll] = useState(false)
  const [categorizationProgress, setCategorizationProgress] = useState({ processed: 0, total: 0, currentItem: '' })
  const [showCategorizationModal, setShowCategorizationModal] = useState(false)

  // Clear data modal state
  const [showClearDataModal, setShowClearDataModal] = useState(false)
  const [clearingData, setClearingData] = useState(false)

  // API Key modal state
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [openRouterApiKey, setOpenRouterApiKey] = useState(process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || '')
  const [categorizationCancelled, setCategorizationCancelled] = useState(false)

  // Export state
  const [exportLoading, setExportLoading] = useState(false)
  const [scheduleData, setScheduleData] = useState<any>(null)
  const [loadingSchedule, setLoadingSchedule] = useState(false)

  // Mileage state
  const [mileageData, setMileageData] = useState<any>(null)
  const [businessMiles, setBusinessMiles] = useState("")
  const [mileageLoading, setMileageLoading] = useState(false)
  const [mileageSaving, setMileageSaving] = useState(false)

  // Home Office state
  const [homeOfficeData, setHomeOfficeData] = useState<any>(null)
  const [homeOfficeSqft, setHomeOfficeSqft] = useState("")
  const [totalHomeSqft, setTotalHomeSqft] = useState("")
  const [useSimplified, setUseSimplified] = useState(true)
  const [homeOfficeLoading, setHomeOfficeLoading] = useState(false)
  const [homeOfficeSaving, setHomeOfficeSaving] = useState(false)

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
      console.log("🔍 Checking for existing data...")
      const summaryData = await api.get("/summary") as any
      console.log("📊 Summary data:", summaryData)
      if (summaryData.success && summaryData.summary.expense_transactions > 0) {
        console.log("✅ Data found, setting hasData=true and staying on upload tab as default")
        setHasData(true)
        setSummary(summaryData)
        // Load business summary for hero numbers
        calculateBusinessSummary()
        // Keep upload tab as default - don't auto-switch to overview
      } else {
        console.log("❌ No data found, staying on upload tab")
        setHasData(false)
      }
    } catch (error) {
      console.log("❌ Error checking for data:", error)
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
      
      // Add sorting parameters
      params.append('sortBy', sortBy)
      params.append('sortOrder', sortOrder)

      const data = await api.get(`/transactions?${params.toString()}`) as any
      console.log(`🔍 API Response - Sort: ${sortBy} ${sortOrder}, First 3 transactions:`, 
        data.transactions?.slice(0, 3).map((t: any) => ({ vendor: t.vendor, amount: t.amount, category: t.category, is_business: t.is_business })))
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
  }, [currentPage, pageSize, searchTerm, selectedCard, selectedType, selectedCategory, sortBy, sortOrder])

  useEffect(() => {
    // Load IRS categories when transactions tab is activated
    if (activeTab === "transactions" && hasData) {
      console.log("📋 Transactions tab activated, loading categories...")
      loadIrsCategories() // Load categories for dropdowns
      // Note: loadTransactions() is handled by the main useEffect below with sorting parameters
    }
  }, [activeTab, hasData])

  // Load schedule data when export tab is activated
  useEffect(() => {
    if (activeTab === "export") {
      loadScheduleData()
    }
  }, [activeTab])

  // Load mileage and home office data when their tabs are activated
  useEffect(() => {
    if (activeTab === "mileage") {
      loadMileageData()
    } else if (activeTab === "homeoffice") {
      loadHomeOfficeData()
    }
  }, [activeTab])

  // Auto-calculate business summary when overview tab is activated
  useEffect(() => {
    if (activeTab === "overview" && hasData) {
      console.log("📊 Overview tab activated, auto-calculating business summary...")
      calculateBusinessSummary()
    }
  }, [activeTab, hasData])

  const loadScheduleData = async () => {
    setLoadingSchedule(true)
    try {
      const data = await api.get("/schedule-c")
      setScheduleData(data)
      console.log("📊 Loaded Schedule C data:", data)
    } catch (error) {
      console.error("Failed to load Schedule C data:", error)
    } finally {
      setLoadingSchedule(false)
    }
  }

  const handleExportPDF = async () => {
    setExportLoading(true)
    try {
      // Use client-side export
      await api.exportPDF()
      console.log("✅ PDF export completed successfully")
    } catch (error) {
      console.error("Export to PDF failed:", error)
      alert("Export to PDF failed. Please try again.")
    } finally {
      setExportLoading(false)
    }
  }

  const handleExportCSV = async () => {
    setExportLoading(true)
    try {
      // Use client-side export
      await api.exportCSV()
      console.log("✅ CSV export completed successfully")
    } catch (error) {
      console.error("Export to CSV failed:", error)
      alert("Export to CSV failed. Please try again.")
    } finally {
      setExportLoading(false)
    }
  }



  // Auto-categorize uncategorized BUSINESS transactions using our best guess
  const autoCategorizeBestGuess = useCallback(async () => {
    try {
      // Find uncategorized BUSINESS transactions
      const uncategorizedBusiness = transactions.filter(t => 
        t.is_business && (!t.category || t.category === 'uncategorized' || t.category === '')
      )
      
      if (uncategorizedBusiness.length === 0) return
      
      console.log(`🤖 Auto-categorizing ${uncategorizedBusiness.length} uncategorized business transactions...`)
      
      // Mark transactions as being auto-categorized
      const uncategorizedIds = new Set(uncategorizedBusiness.map(t => t.id))
      setAutoCategorizingTransactions(uncategorizedIds)
      
      // Call the bulk categorization endpoint
      const result = await api.post("/categorize", {})
      
      if (result.success && result.processed > 0) {
        // Reload transactions to show updated categories
        await loadTransactions()
        console.log(`✅ Auto-categorized ${result.processed} business transactions with best guesses`)
      }
    } catch (error) {
      console.error("Failed to auto-categorize transactions:", error)
    } finally {
      setAutoCategorizingTransactions(new Set())
    }
  }, [transactions, loadTransactions])

  // Show API key modal before categorization  
  const showApiKeyModalAndCategorize = () => {
    // If API key is already available from environment, start categorization immediately
    if (openRouterApiKey.trim()) {
      console.log('🔑 API key available from environment, starting categorization directly...')
      triggerManualCategorization()
    } else {
      // Otherwise show modal for user to enter API key
      setShowApiKeyModal(true)
    }
  }

  // Cancel categorization
  const cancelCategorization = () => {
    console.log('🛑 Categorization cancelled by user')
    setCategorizationCancelled(true)
    setShowCategorizationModal(false)
    setAutoCategorizingAll(false)
    setAutoCategorizingTransactions(new Set())
    setCategorizationProgress({ processed: 0, total: 0, currentItem: 'Cancelled' })
  }

  // Manual trigger for auto-categorization with progress tracking
  const triggerManualCategorization = async () => {
    try {
      console.log('🎯 Manually triggering auto-categorization...')
      setAutoCategorizingAll(true)
      setShowCategorizationModal(true)
      setCategorizationCancelled(false)
      setCategorizationProgress({ processed: 0, total: 0, currentItem: 'Refreshing transaction data...' })
      setAutoCategorizingTransactions(new Set())
      
      // Force reload transactions from database to get fresh data
      console.log('🔄 Reloading transactions to get fresh data...')
      await loadTransactions()
      
      // Count uncategorized BUSINESS transactions dynamically
      const uncategorizedBusiness = transactions.filter(t => 
        t.is_business && (!t.category || t.category === 'uncategorized' || t.category === '')
      )
      const totalTransactions = uncategorizedBusiness.length
      
      setCategorizationProgress({ processed: 0, total: totalTransactions, currentItem: 'Starting AI categorization...' })
      console.log(`📊 Found ${totalTransactions} uncategorized transactions to process`)
      
      // Simulate progress updates while API processes
      let currentProgress = 0
      const progressInterval = setInterval(() => {
        currentProgress += Math.floor(Math.random() * 3) + 1 // Random progress 1-3
        if (currentProgress < totalTransactions - 5) { // Don't go too close to completion
          const batchNumber = Math.ceil(currentProgress / 10)
          setCategorizationProgress({ 
            processed: currentProgress, 
            total: totalTransactions, 
            currentItem: `Processing batch ${batchNumber} - Analyzing transaction ${currentProgress}...` 
          })
        }
      }, 2000) // Update every 2 seconds
      
      // Start categorization
      const result = await api.post("/categorize", { api_key: openRouterApiKey })
      console.log('📋 Categorization result:', result)
      
      // Clear the progress simulation
      clearInterval(progressInterval)
      
      if (result.success && result.processed > 0) {
        console.log(`✅ Auto-categorized ${result.processed} transactions with best guesses`)
        setCategorizationProgress({ 
          processed: result.processed, 
          total: result.total || result.processed, 
          currentItem: `Completed! Successfully categorized ${result.processed} transactions.` 
        })
        
        // Wait a moment to show completion, then reload
        setTimeout(async () => {
          await loadTransactions()
          await loadSummary()
          setShowCategorizationModal(false)
        }, 2000)
      } else if (result.no_business_transactions) {
        // Special case: No business transactions marked
        console.log('⚠️ No business transactions found - user needs to mark transactions as business first')
        setCategorizationProgress({ processed: 0, total: 0, currentItem: result.message })
        setTimeout(() => setShowCategorizationModal(false), 4000)
        
        // Show alert with the instruction
        setTimeout(() => {
          alert('💡 To use AI categorization:\n\n1. First mark transactions as "Business" using the checkboxes\n2. Then click "Try AI Auto-Categorization"\n\nOnly business transactions will be categorized for tax purposes.')
        }, 1000)
      } else {
        console.log('ℹ️ No transactions were categorized - they may already be categorized')
        setCategorizationProgress({ processed: 0, total: 0, currentItem: 'No uncategorized business transactions found' })
        setTimeout(() => setShowCategorizationModal(false), 2000)
      }
    } catch (error) {
      console.error("Failed to auto-categorize transactions:", error)
      setCategorizationProgress({ processed: 0, total: 0, currentItem: 'Error occurred during categorization' })
      setTimeout(() => setShowCategorizationModal(false), 3000)
    } finally {
      setAutoCategorizingAll(false)
      setAutoCategorizingTransactions(new Set())
    }
  }

  // Note: Removed automatic categorization trigger - only manual triggering now

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

  const loadMileageData = async () => {
    try {
      setMileageLoading(true)
      const data = await api.get("/deductions")
      setMileageData(data)
      if (data.business_miles) {
        setBusinessMiles(data.business_miles.toString())
      }
    } catch (error) {
      console.error("Failed to load mileage data:", error)
    } finally {
      setMileageLoading(false)
    }
  }

  const saveMileageData = async () => {
    try {
      setMileageSaving(true)
      const response = await api.post("/vehicle", {
        business_miles: parseInt(businessMiles) || 0
      })
      
      if (response.success) {
        setMileageData(response)
        setError(null)
        // Update hero numbers to include new mileage deduction
        calculateBusinessSummary()
      }
    } catch (error) {
      console.error("Failed to save mileage data:", error)
      setError("Failed to save mileage data")
    } finally {
      setMileageSaving(false)
    }
  }

  const loadHomeOfficeData = async () => {
    try {
      setHomeOfficeLoading(true)
      const data = await api.get("/deductions")
      setHomeOfficeData(data)
      if (data.home_office_sqft) {
        setHomeOfficeSqft(data.home_office_sqft.toString())
      }
      if (data.total_home_sqft) {
        setTotalHomeSqft(data.total_home_sqft.toString())
      }
      if (data.use_simplified !== undefined) {
        setUseSimplified(data.use_simplified)
      }
    } catch (error) {
      console.error("Failed to load home office data:", error)
    } finally {
      setHomeOfficeLoading(false)
    }
  }

  const saveHomeOfficeData = async () => {
    try {
      setHomeOfficeSaving(true)
      const response = await api.post("/home-office", {
        home_office_sqft: parseInt(homeOfficeSqft) || 0,
        total_home_sqft: parseInt(totalHomeSqft) || 0,
        use_simplified: useSimplified
      })
      
      if (response.success) {
        setHomeOfficeData(response)
        setError(null)
        // Update hero numbers to include new home office deduction
        calculateBusinessSummary()
      }
    } catch (error) {
      console.error("Failed to save home office data:", error)
      setError("Failed to save home office data")
    } finally {
      setHomeOfficeSaving(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFiles(e.dataTransfer.files)
    }
  }

  const validateAndSetFile = (file: File) => {
    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      setUploadError("Please select a CSV file")
      return false
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File size must be less than 10MB")
      return false
    }
    return true
  }

  const validateAndSetFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const validFiles: File[] = []
    
    for (const file of fileArray) {
      if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
        setUploadError(`${file.name} is not a CSV file`)
        return false
      }
      if (file.size > 10 * 1024 * 1024) {
        setUploadError(`${file.name} is larger than 10MB`)
        return false
      }
      validFiles.push(file)
    }
    
    setSelectedFiles(validFiles)
    setSelectedFile(validFiles[0] || null) // Keep single file for backward compatibility
    setUploadError(null)
    return true
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileInput = e.target as HTMLInputElement
    const files = fileInput.files
    if (files && files.length > 0) {
      validateAndSetFiles(files)
    }
    // Allow multiple file selection
    fileInput.setAttribute('multiple', 'true')
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return

    try {
      setUploading(true)
      setUploadError(null)
      setUploadProgress({})

      // Use multi-file upload for better progress tracking
      const result = await api.uploadMultipleCSV(selectedFiles, sourceType)

      if (result.totalFailed > 0) {
        const failedFiles = result.results.filter(r => !r.success).map(r => r.file).join(', ')
        setUploadError(`${result.totalFailed} files failed to upload: ${failedFiles}`)
      }

      if (result.totalUploaded > 0) {
        setUploadSuccess(true)
        setHasData(true)

        // Add successful uploads to recent uploads
        const successfulUploads = result.results
          .filter(r => r.success)
          .map((r, index) => ({
            id: (Date.now() + index).toString(),
            name: r.file,
            size: selectedFiles.find(f => f.name === r.file)?.size || 0,
            uploadDate: new Date().toISOString(),
            transactionCount: r.result?.transactions_parsed || 0,
          }))

        setRecentUploads((prev) => [...successfulUploads, ...prev.slice(0, 4 - successfulUploads.length)])

        // Clear selected files
        setSelectedFiles([])
        setSelectedFile(null)

        // Auto-redirect to transactions tab after successful upload
        setHasData(true)
        setTimeout(() => {
          setUploadSuccess(false)
          loadSummary()
          // Automatically switch to transactions tab to view uploaded data
          setActiveTab("transactions")
          console.log("🚀 Auto-redirecting to transactions tab after successful upload")
        }, 3000)
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
      setUploadProgress({})
    }
  }

  // Update effect dependencies to include filters and sorting
  useEffect(() => {
    if (hasData && activeTab === "transactions") {
      loadTransactions()
      // Also check overall business status for master toggle
      checkOverallBusinessStatus()
    }
  }, [currentPage, pageSize, searchTerm, selectedCard, selectedType, selectedCategory, sortBy, sortOrder, hasData, activeTab, loadTransactions])

  // Separate effect to reset to page 1 when filters or sorting changes (but not when page changes)
  useEffect(() => {
    if (hasData && activeTab === "transactions" && currentPage !== 1) {
      setCurrentPage(1)
    }
  }, [searchTerm, selectedCard, selectedType, selectedCategory, sortBy, sortOrder, hasData, activeTab])

  // Load recurring transactions when recurring tab is active
  useEffect(() => {
    if (hasData && activeTab === "recurring") {
      loadRecurringTransactions()
    }
  }, [hasData, activeTab])

  // Load Schedule C data when export tab is active
  useEffect(() => {
    if (hasData && activeTab === "export") {
      loadScheduleData()
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
      // Update hero numbers in real-time
      calculateBusinessSummary()
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
      console.log('🧮 Calculating business summary from client storage...')
      
      // Load all transactions from client storage (LocalForage)
      const allTransactions = await clientStorage.getTransactions()
      const deductions = await clientStorage.getDeductions()
      
      const businessTransactions = allTransactions.filter((t: any) => t.is_business)
      const personalTransactions = allTransactions.filter((t: any) => !t.is_business)
      
      // For CSV transactions, all are expenses (no income)
      const transactionBusinessExpenses = businessTransactions.reduce((sum: number, t: any) => sum + t.amount, 0)
      const personalExpenses = personalTransactions.reduce((sum: number, t: any) => sum + t.amount, 0)
      
      // Load mileage and home office deductions 
      const mileageDeduction = deductions.mileage?.deduction_amount || 0
      const homeOfficeDeduction = deductions.home_office?.deduction_amount || 0
      
      // Total business expenses = transaction expenses + mileage + home office
      const totalBusinessExpenses = transactionBusinessExpenses + mileageDeduction + homeOfficeDeduction
      
      console.log('📊 Hero numbers calculated:', {
        business_transactions: businessTransactions.length,
        business_expenses: totalBusinessExpenses,
        transaction_expenses: transactionBusinessExpenses,
        mileage_deduction: mileageDeduction,
        home_office_deduction: homeOfficeDeduction
      })
      
      setBusinessSummary({
        business_expenses: totalBusinessExpenses,
        business_income: 0, // CSV transactions are all expenses
        business_transactions: businessTransactions.length,
        personal_transactions: personalTransactions.length,
        net_profit_loss: -totalBusinessExpenses, // All expenses, no income
        personal_expenses: personalExpenses,
        total_transactions: allTransactions.length,
        // Add breakdown for debugging
        transaction_expenses: transactionBusinessExpenses,
        mileage_deduction: mileageDeduction,
        home_office_deduction: homeOfficeDeduction
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
      
      // Update hero numbers after bulk toggle
      calculateBusinessSummary()
    } catch (error) {
      console.error("Failed to toggle all business status:", error)
    } finally {
      setToggleLoading(null)
    }
  }

  // Sorting handler
  const handleSort = (column: "amount" | "date" | "vendor" | "category" | "business") => {
    if (sortBy === column) {
      // Toggle sort order if clicking the same column
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      // Set new column and default sort order
      setSortBy(column)
      if (column === "amount") {
        setSortOrder("desc") // Default: highest amounts first
      } else if (column === "vendor") {
        setSortOrder("asc")  // Default: alphabetical A-Z
      } else if (column === "date") {
        setSortOrder("desc") // Default: newest first
      } else if (column === "category") {
        setSortOrder("asc")  // Default: alphabetical A-Z
      } else if (column === "business") {
        setSortOrder("desc") // Default: business first, then personal
      }
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
      
      // Update hero numbers after recurring changes
      calculateBusinessSummary()
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
      
      // Update hero numbers after recurring transaction change
      calculateBusinessSummary()
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

  const handleClearAllData = async () => {
    console.log('🗑️ Clear data button clicked!')
    setClearingData(true)
    try {
      console.log('🗑️ Calling API to clear data...')
      const result = await api.delete('/clear-all-data')
      console.log('🗑️ API response:', result)
      
      // Reset all state
      setTransactions([])
      setSummary(null)
      setHasData(false)
      setBusinessSummary(null)
      setRecurringTransactions([])
      setActiveTab("upload")
      setShowClearDataModal(false)
      
      // Show success message
      console.log('✅ All data cleared successfully!')
      alert('All data has been cleared successfully!')
    } catch (error) {
      console.error('❌ Failed to clear data:', error)
      alert('Failed to clear data: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setClearingData(false)
    }
  }

  // Load IRS categories (static list for client-only app)
  const loadIrsCategories = async () => {
    if (categoriesLoaded) return
    
    console.log("🏷️ Loading IRS categories...")
    
    // Static list of IRS Schedule C categories
    const categories = [
      { id: 1, name: "Office Supplies", value: "office_supplies", schedule_c_line: 18 },
      { id: 2, name: "Travel", value: "travel", schedule_c_line: 24 },
      { id: 3, name: "Meals", value: "meals", schedule_c_line: 24 },
      { id: 4, name: "Advertising", value: "advertising", schedule_c_line: 8 },
      { id: 5, name: "Utilities", value: "utilities", schedule_c_line: 25 },
      { id: 6, name: "Software", value: "software", schedule_c_line: 18 },
      { id: 7, name: "Professional Services", value: "professional_services", schedule_c_line: 17 },
      { id: 8, name: "Other", value: "other", schedule_c_line: 27 },
      { id: 9, name: "Insurance", value: "insurance", schedule_c_line: 15 },
      { id: 10, name: "Interest", value: "interest", schedule_c_line: 16 },
      { id: 11, name: "Rent", value: "rent", schedule_c_line: 20 },
      { id: 12, name: "Taxes & Licenses", value: "taxes_licenses", schedule_c_line: 23 }
    ]
    
    console.log("🏷️ Categories loaded:", categories.length, "categories")
    setIrsCategories(categories)
    setCategoriesLoaded(true)
  }

  // Update transaction category
  const handleCategoryChange = async (transactionId: string, categoryName: string, lineNumber: number) => {
    try {
      setToggleLoading(`category-${transactionId}`)
      
      // Update in client storage
      const allTransactions = await clientStorage.getTransactions()
      const updatedTransactions = allTransactions.map(t => 
        t.id === transactionId 
          ? { ...t, category: categoryName, schedule_c_line: lineNumber } 
          : t
      )
      await clientStorage.saveTransactions(updatedTransactions)
      
      // Update local state
      setTransactions(prev => 
        prev.map(t => 
          t.id === transactionId 
            ? { ...t, category: categoryName, schedule_c_line: lineNumber } 
            : t
        )
      )
      
      console.log(`✅ Category updated: ${categoryName} (Line ${lineNumber})`)
      
      // Reload transactions to ensure consistency
      await loadTransactions()
      
      // Recalculate business summary for Schedule C
      await calculateBusinessSummary()
    } catch (error) {
      console.error(`Failed to update category for transaction ${transactionId}:`, error)
    } finally {
      setToggleLoading(null)
    }
  }

  const renderUpload = () => (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Upload Card */}
      <Card className="border border-gray-700 bg-gray-800/50 backdrop-blur-sm">
        <CardContent className="p-8">
          <div
            className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              dragActive
                ? "border-blue-500 bg-blue-900/20"
                : selectedFiles.length > 0
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
              multiple
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            <div className="space-y-4">
              {selectedFiles.length > 0 ? (
                <>
                  <Check className="h-12 w-12 text-green-400 mx-auto" />
                  <div>
                    <p className="text-lg font-medium text-green-300">
                      {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
                    </p>
                    <div className="mt-2 space-y-1">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-700/50 rounded text-sm">
                          <span className="text-green-300">{file.name}</span>
                          <span className="text-green-400">{formatFileSize(file.size)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedFiles([])
                      setSelectedFile(null)
                    }}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                </>
              ) : (
                <>
                  <Cloud className="h-12 w-12 text-gray-400 mx-auto" />
                  <div>
                    <p className="text-lg font-medium text-gray-200">
                      Drag and drop your CSV files here, or click to browse
                    </p>
                    <p className="text-sm text-gray-400">Multiple CSV files supported, max 10MB each</p>
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
          disabled={selectedFiles.length === 0 || uploading}
          size="lg"
          className="px-8 bg-blue-600 hover:bg-blue-700 text-white"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload and Process {selectedFiles.length > 0 ? `${selectedFiles.length} ` : ''}CSV{selectedFiles.length !== 1 ? 's' : ''}
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
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-200">Business Overview</h2>
            <p className="text-sm text-gray-400">
              {isCalculating ? "Calculating totals based on your business selections..." : "Financial summary updated automatically"}
            </p>
          </div>
          {isCalculating && (
            <div className="flex items-center text-blue-400">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              <span className="text-sm">Calculating...</span>
            </div>
          )}
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
                {businessSummary ? `${businessSummary.business_transactions} business transactions` : "Calculating..."}
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
                {businessSummary ? `${businessSummary.personal_transactions} personal transactions` : "Calculating..."}
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
                  "Calculating..."
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

        {/* Success Feedback and Encouragement */}
        {businessSummary && businessSummary.business_transactions === 0 && (
          <Alert className="border-amber-900 bg-amber-900/20">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <AlertDescription className="text-amber-300">
              No business transactions selected. Go to the Transactions tab and mark transactions as business expenses to see your Schedule C overview.
            </AlertDescription>
          </Alert>
        )}
        
        {businessSummary && businessSummary.business_transactions > 0 && (
          <Alert className="border-green-700 bg-green-900/20">
            <Check className="h-4 w-4 text-green-400" />
            <AlertDescription className="text-green-300">
              Great progress! You've categorized {businessSummary.business_transactions} business transactions. 
              {businessSummary.business_transactions >= 10 && " You're well on your way to completing your Schedule C!"}
              {businessSummary.business_transactions >= 50 && " Excellent work - your accountant will be impressed with this organization!"}
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
                  {uniqueCards.map((card) => (
                    <option key={card} value={card}>{card}</option>
                  ))}
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
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-100">Bulk Actions</CardTitle>
            <CardDescription className="text-gray-400">
              ✅ Checked = Business • ⬜ Unchecked = Personal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
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
                
                <button
                  onClick={triggerManualCategorization}
                  disabled={autoCategorizingAll}
                  style={{
                    height: '32px',
                    padding: '0 12px',
                    backgroundColor: autoCategorizingAll ? '#6b46c1' : '#7c3aed',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: autoCategorizingAll ? 'not-allowed' : 'pointer',
                    opacity: autoCategorizingAll ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!autoCategorizingAll) {
                      e.currentTarget.style.backgroundColor = '#6d28d9'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!autoCategorizingAll) {
                      e.currentTarget.style.backgroundColor = '#7c3aed'
                    }
                  }}
                >
                  {autoCategorizingAll ? (
                    <>
                      <svg
                        style={{
                          width: '12px',
                          height: '12px',
                          animation: 'spin 1s linear infinite'
                        }}
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          style={{ opacity: 0.25 }}
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          style={{ opacity: 0.75 }}
                          fill="currentColor"
                          d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      AI Categorizing...
                    </>
                  ) : (
                    <>
                      🤖 Try AI Auto-Categorization
                    </>
                  )}
                </button>
              </div>
              {toggleLoading === "all" && (
                <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Transactions Table - Card-like Layout */}
        <Card className="bg-gradient-to-br from-gray-800 via-gray-850 to-gray-900 border-gray-600 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-gray-100 flex items-center space-x-2">
                  <Receipt className="h-5 w-5 text-blue-400" />
                  <span>Transaction Review</span>
                </CardTitle>
                <CardDescription className="text-gray-300 mt-1">
                  Page {currentPage} of {Math.ceil(totalTransactions / pageSize)} • {totalTransactions} total transactions
                </CardDescription>
              </div>
              {businessSummary && (
                <div className="text-right">
                  <div className="text-sm text-gray-300">Categorization Progress</div>
                  <div className="text-lg font-semibold text-green-400 flex items-center space-x-2">
                    <span>{businessSummary.business_transactions} business selected</span>
                    {businessSummary.business_transactions > 0 && (
                      <div className="text-green-400 animate-pulse">
                        ✓
                      </div>
                    )}
                  </div>
                  {/* Progress Bar */}
                  <div className="mt-2 w-32">
                    <div className="bg-gray-600 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-green-400 to-green-500 h-2 rounded-full transition-all duration-500 ease-out"
                        style={{ 
                          width: `${Math.min(100, (businessSummary.business_transactions / businessSummary.total_transactions) * 100)}%` 
                        }}
                      />
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {Math.round((businessSummary.business_transactions / businessSummary.total_transactions) * 100)}% categorized
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-700/50">
                    <tr className="border-b border-gray-600">
                      <th 
                        className="text-left py-4 px-4 text-gray-300 font-semibold cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSort("date")}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Date</span>
                          {sortBy === "date" && (
                            <div className="flex flex-col">
                              {sortOrder === "asc" ? (
                                <div className="w-0 h-0 border-l-2 border-r-2 border-b-2 border-transparent border-b-blue-400"></div>
                              ) : (
                                <div className="w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-blue-400"></div>
                              )}
                            </div>
                          )}
                        </div>
                      </th>
                      <th 
                        className="text-left py-4 px-4 text-gray-300 font-semibold cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSort("vendor")}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Vendor</span>
                          {sortBy === "vendor" && (
                            <div className="flex flex-col">
                              {sortOrder === "asc" ? (
                                <div className="w-0 h-0 border-l-2 border-r-2 border-b-2 border-transparent border-b-blue-400"></div>
                              ) : (
                                <div className="w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-blue-400"></div>
                              )}
                            </div>
                          )}
                        </div>
                      </th>
                      <th 
                        className="text-left py-4 px-4 text-gray-300 font-semibold cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSort("amount")}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Amount</span>
                          {sortBy === "amount" && (
                            <div className="flex flex-col">
                              {sortOrder === "asc" ? (
                                <div className="w-0 h-0 border-l-2 border-r-2 border-b-2 border-transparent border-b-blue-400"></div>
                              ) : (
                                <div className="w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-blue-400"></div>
                              )}
                            </div>
                          )}
                        </div>
                      </th>
                      <th 
                        className="text-left py-4 px-4 text-gray-300 font-semibold cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSort("category")}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Category</span>
                          {sortBy === "category" && (
                            <div className="flex flex-col">
                              {sortOrder === "asc" ? (
                                <div className="w-0 h-0 border-l-2 border-r-2 border-b-2 border-transparent border-b-blue-400"></div>
                              ) : (
                                <div className="w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-blue-400"></div>
                              )}
                            </div>
                          )}
                        </div>
                      </th>
                      <th 
                        className="text-left py-4 px-4 text-gray-300 font-semibold cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSort("business")}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Business/Personal</span>
                          {sortBy === "business" && (
                            <div className="flex flex-col">
                              {sortOrder === "asc" ? (
                                <div className="w-0 h-0 border-l-2 border-r-2 border-b-2 border-transparent border-b-blue-400"></div>
                              ) : (
                                <div className="w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-blue-400"></div>
                              )}
                            </div>
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((transaction: any) => {
                      // Determine color coding for visual appeal
                      let rowColorClass = ""
                      let borderColorClass = ""
                      
                      if (transaction.is_business) {
                        // Green for business transactions
                        rowColorClass = "bg-green-900/10 hover:bg-green-900/20"
                        borderColorClass = "border-l-4 border-l-green-500"
                      } else {
                        // Gray for personal transactions  
                        rowColorClass = "bg-gray-800/20 hover:bg-gray-700/30"
                        borderColorClass = "border-l-4 border-l-gray-500"
                      }
                      
                      // Yellow for transactions needing attention (uncategorized)
                      if (!transaction.category || transaction.category === 'uncategorized') {
                        rowColorClass = "bg-yellow-900/10 hover:bg-yellow-900/20"
                        borderColorClass = "border-l-4 border-l-yellow-500"
                      }
                      
                      return (
                        <tr key={transaction.id} className={`border-b border-gray-700/30 transition-all duration-200 ${rowColorClass} ${borderColorClass}`}>
                          <td className="py-4 px-4 text-gray-300 font-medium">
                            {new Date(transaction.date).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-4 text-gray-100 max-w-[200px]">
                            <div className="flex items-center space-x-3">
                              {/* Enhanced color-coded dot indicator */}
                              <div 
                                className={`w-3 h-3 rounded-full shadow-lg ${
                                  transaction.is_business 
                                    ? 'bg-green-400 shadow-green-400/30' 
                                    : (!transaction.category || transaction.category === 'uncategorized')
                                      ? 'bg-yellow-400 shadow-yellow-400/30'
                                      : 'bg-gray-400 shadow-gray-400/30'
                                }`}
                              />
                              <span className="font-medium truncate">{transaction.vendor || transaction.description || 'Unknown'}</span>
                            </div>
                          </td>
                          <td className={`py-4 px-4 font-bold text-base ${transaction.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                            {transaction.type === 'income' ? '+' : '-'}${Math.abs(transaction.amount).toFixed(2)}
                          </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-2">
                            <div className="relative w-full max-w-[200px]">
                              <Select
                                value={transaction.category || ""}
                                onValueChange={(value) => {
                                  const category = irsCategories.find(cat => cat.value === value)
                                  if (category) {
                                    handleCategoryChange(transaction.id, category.value, category.schedule_c_line)
                                  }
                                }}
                                disabled={toggleLoading === `category-${transaction.id}` || autoCategorizingTransactions.has(transaction.id)}
                              >
                                <SelectTrigger className={`w-full h-8 text-xs bg-gray-700 border-gray-600 text-white ${
                                  transaction.category && transaction.category !== 'uncategorized' 
                                    ? 'border-green-600 bg-green-900/20' 
                                    : autoCategorizingTransactions.has(transaction.id) 
                                      ? 'border-blue-600 bg-blue-900/20' 
                                      : ''
                                }`}>
                                  <SelectValue placeholder={
                                    autoCategorizingTransactions.has(transaction.id) 
                                      ? "Auto-categorizing..." 
                                      : "Select category..."
                                  } />
                                </SelectTrigger>
                                <SelectContent className="bg-gray-700 border-gray-600">
                                  {irsCategories.length === 0 && (
                                    <SelectItem value="loading" disabled className="text-gray-400">
                                      Loading categories...
                                    </SelectItem>
                                  )}
                                  {irsCategories.map((category) => (
                                    <SelectItem key={category.id} value={category.value} className="text-white hover:bg-gray-600">
                                      {category.name} (L{category.schedule_c_line})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {/* Visual indicator for categorized transactions */}
                              {transaction.category && transaction.category !== 'uncategorized' && (
                                <div className="absolute -right-1 -top-1 w-2 h-2 bg-green-500 rounded-full"></div>
                              )}
                            </div>
                            {(toggleLoading === `category-${transaction.id}` || autoCategorizingTransactions.has(transaction.id)) && (
                              <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              checked={transaction.is_business}
                              onCheckedChange={(checked) => handleToggleBusiness(transaction.id, !!checked)}
                              disabled={toggleLoading === transaction.id}
                              className="bg-gray-700 border-gray-600 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 w-5 h-5"
                            />
                            <span className={`text-sm font-semibold ${transaction.is_business ? 'text-green-400' : 'text-gray-400'}`}>
                              {transaction.is_business ? 'Business' : 'Personal'}
                            </span>
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
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



  const renderExport = () => {

    if (loadingSchedule) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 text-blue-400 mx-auto mb-4 animate-spin" />
            <p className="text-gray-400">Loading Schedule C data...</p>
          </div>
        </div>
      )
    }

    if (!scheduleData) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-4" />
            <p className="text-red-400 font-medium">No Schedule C data available</p>
            <p className="text-gray-400 text-sm">Please upload and categorize transactions first</p>
          </div>
        </div>
      )
    }

    const scheduleC = scheduleData.schedule_c
    const summary = scheduleData.summary

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Schedule C Export</h2>
            <p className="text-gray-400">IRS Form 1040 - Schedule C (Form 1040)</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExportPDF}
              disabled={exportLoading}
              style={{
                backgroundColor: exportLoading ? '#374151' : '#dc2626',
                color: '#ffffff',
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: '600',
                fontSize: '14px',
                cursor: exportLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!exportLoading) e.currentTarget.style.backgroundColor = '#b91c1c'
              }}
              onMouseLeave={(e) => {
                if (!exportLoading) e.currentTarget.style.backgroundColor = '#dc2626'
              }}
            >
              {exportLoading ? (
                <RefreshCw style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
              ) : (
                <FileText style={{ width: '16px', height: '16px' }} />
              )}
              Export PDF
            </button>
            <button
              onClick={handleExportCSV}
              disabled={exportLoading}
              style={{
                backgroundColor: exportLoading ? '#374151' : '#059669',
                color: '#ffffff',
                padding: '12px 24px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: '600',
                fontSize: '14px',
                cursor: exportLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!exportLoading) e.currentTarget.style.backgroundColor = '#047857'
              }}
              onMouseLeave={(e) => {
                if (!exportLoading) e.currentTarget.style.backgroundColor = '#059669'
              }}
            >
              {exportLoading ? (
                <RefreshCw style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
              ) : (
                <Download style={{ width: '16px', height: '16px' }} />
              )}
              Export CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Summary Cards */}
          <Card style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Gross Receipts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400">
                {formatCurrency(scheduleC.line1_gross_receipts)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Line 1</p>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Total Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-400">
                {formatCurrency(scheduleC.line28_total_expenses)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Line 28</p>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Net Profit/Loss</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${scheduleC.line31_net_profit_loss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(scheduleC.line31_net_profit_loss)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Line 31</p>
            </CardContent>
          </Card>
        </div>

        {/* Official Schedule C Form Layout */}
        <Card style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
          <CardHeader>
            <CardTitle className="text-xl text-white">Schedule C (Form 1040) - Profit or Loss From Business</CardTitle>
            <CardDescription className="text-gray-400">Tax Year {scheduleData.tax_year}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Part I - Income */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-2">Part I - Income</h3>
                <div className="grid grid-cols-12 gap-4 items-center py-2">
                  <div className="col-span-1 text-sm font-medium text-gray-400">1</div>
                  <div className="col-span-8 text-sm text-gray-300">Gross receipts or sales</div>
                  <div className="col-span-3 text-right text-white font-mono">{formatCurrency(scheduleC.line1_gross_receipts)}</div>
                </div>
              </div>

              {/* Part II - Expenses */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-2">Part II - Expenses</h3>
                <div className="space-y-2">
                  {[
                    { line: 8, label: "Advertising", value: scheduleC.line8_advertising },
                    { line: 9, label: "Car and truck expenses", value: scheduleC.line9_car_truck },
                    { line: 10, label: "Commissions and fees", value: scheduleC.line10_commissions_fees },
                    { line: 11, label: "Contract labor", value: scheduleC.line11_contract_labor },
                    { line: 12, label: "Depletion", value: scheduleC.line12_depletion },
                    { line: 13, label: "Depreciation and section 179", value: scheduleC.line13_depreciation },
                    { line: 14, label: "Employee benefit programs", value: scheduleC.line14_employee_benefits },
                    { line: 15, label: "Insurance (other than health)", value: scheduleC.line15_insurance },
                    { line: 16, label: "Interest", value: scheduleC.line16_interest },
                    { line: 17, label: "Legal and professional services", value: scheduleC.line17_legal_professional },
                    { line: 18, label: "Office expense", value: scheduleC.line18_office_expense },
                    { line: 19, label: "Pension and profit-sharing plans", value: scheduleC.line19_pension_profit },
                    { line: 20, label: "Rent or lease", value: scheduleC.line20_rent_lease },
                    { line: 21, label: "Repairs and maintenance", value: scheduleC.line21_repairs_maintenance },
                    { line: 22, label: "Supplies", value: scheduleC.line22_supplies },
                    { line: 23, label: "Taxes and licenses", value: scheduleC.line23_taxes_licenses },
                    { line: 24, label: "Travel and meals", value: scheduleC.line24_travel_meals },
                    { line: 25, label: "Utilities", value: scheduleC.line25_utilities },
                    { line: 26, label: "Wages", value: scheduleC.line26_wages },
                    { line: 27, label: "Other expenses", value: scheduleC.line27_other_expenses }
                  ].map((item) => (
                    <div key={item.line} className={`grid grid-cols-12 gap-4 items-center py-2 ${item.value > 0 ? 'bg-gray-800/30' : ''} rounded`}>
                      <div className="col-span-1 text-sm font-medium text-gray-400">{item.line}</div>
                      <div className="col-span-8 text-sm text-gray-300">{item.label}</div>
                      <div className="col-span-3 text-right text-white font-mono">
                        {item.value > 0 ? formatCurrency(item.value) : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t border-gray-700 pt-4">
                <div className="grid grid-cols-12 gap-4 items-center py-2 bg-gray-800/50 rounded">
                  <div className="col-span-1 text-sm font-bold text-gray-300">28</div>
                  <div className="col-span-8 text-sm font-bold text-gray-300">Total expenses</div>
                  <div className="col-span-3 text-right text-white font-mono font-bold">{formatCurrency(scheduleC.line28_total_expenses)}</div>
                </div>
                
                {scheduleC.line30_home_office > 0 && (
                  <div className="grid grid-cols-12 gap-4 items-center py-2">
                    <div className="col-span-1 text-sm font-medium text-gray-400">30</div>
                    <div className="col-span-8 text-sm text-gray-300">Home office deduction</div>
                    <div className="col-span-3 text-right text-white font-mono">{formatCurrency(scheduleC.line30_home_office)}</div>
                  </div>
                )}

                <div className="grid grid-cols-12 gap-4 items-center py-3 bg-blue-900/30 rounded mt-2">
                  <div className="col-span-1 text-sm font-bold text-blue-300">31</div>
                  <div className="col-span-8 text-sm font-bold text-blue-300">Net profit or (loss)</div>
                  <div className={`col-span-3 text-right font-mono font-bold text-lg ${scheduleC.line31_net_profit_loss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(scheduleC.line31_net_profit_loss)}
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              <div className="bg-gray-800/20 rounded-lg p-4 mt-6">
                <h4 className="text-sm font-semibold text-gray-300 mb-2">Calculation Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Income Transactions:</span>
                    <div className="text-white font-medium">{summary.income_transactions}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Expense Transactions:</span>
                    <div className="text-white font-medium">{summary.expense_transactions}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Vehicle Miles:</span>
                    <div className="text-white font-medium">{summary.vehicle_miles || 0}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Home Office Sq Ft:</span>
                    <div className="text-white font-medium">{summary.home_office_sqft || 0}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Generated on {scheduleData.calculation_date}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Progress Modal Component - Fixed with CSS overrides like delete modal
  const renderCategorizationModal = () => {
    if (!showCategorizationModal) return null

    const progressPercentage = categorizationProgress.total > 0 
      ? Math.round((categorizationProgress.processed / categorizationProgress.total) * 100)
      : 0

    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        <div
          style={{
            backgroundColor: '#1f2937',
            borderRadius: '12px',
            padding: '32px',
            maxWidth: '480px',
            width: '90%',
            margin: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            border: '1px solid #374151'
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '24px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '64px',
                  height: '64px',
                  backgroundColor: '#7c3aed',
                  borderRadius: '50%',
                  marginBottom: '16px'
                }}
              >
                <svg
                  style={{
                    width: '32px',
                    height: '32px',
                    color: '#ffffff',
                    animation: 'spin 1s linear infinite'
                  }}
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    style={{ opacity: 0.25 }}
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    style={{ opacity: 0.75 }}
                    fill="currentColor"
                    d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
              <h3
                style={{
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: '#f9fafb',
                  marginBottom: '8px',
                  margin: '0 0 8px 0'
                }}
              >
                🤖 AI Auto-Categorization
              </h3>
              <p
                style={{
                  color: '#9ca3af',
                  fontSize: '14px',
                  marginBottom: '16px',
                  margin: '0 0 16px 0'
                }}
              >
                {categorizationProgress.currentItem}
              </p>
            </div>

            {categorizationProgress.total > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '14px',
                    color: '#d1d5db',
                    marginBottom: '8px'
                  }}
                >
                  <span>Progress</span>
                  <span>{categorizationProgress.processed} / {categorizationProgress.total}</span>
                </div>
                <div
                  style={{
                    width: '100%',
                    backgroundColor: '#374151',
                    borderRadius: '9999px',
                    height: '8px'
                  }}
                >
                  <div
                    style={{
                      backgroundColor: '#7c3aed',
                      height: '8px',
                      borderRadius: '9999px',
                      transition: 'width 0.3s ease',
                      width: `${progressPercentage}%`
                    }}
                  ></div>
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#9ca3af',
                    marginTop: '4px'
                  }}
                >
                  {progressPercentage}% complete
                </div>
              </div>
            )}

            <div
              style={{
                fontSize: '12px',
                color: '#6b7280',
                marginBottom: '24px'
              }}
            >
              This may take a few minutes for large datasets...
            </div>

            {/* Cancel Button */}
            <button
              onClick={cancelCategorization}
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '500',
                backgroundColor: '#374151',
                color: '#f9fafb',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#4b5563'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#374151'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  const renderMileage = () => (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle 
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#f9fafb',
              margin: '0'
            }}
          >
            🚗 Business Mileage Deduction
          </CardTitle>
          <CardDescription 
            style={{
              color: '#9ca3af',
              fontSize: '14px',
              margin: '8px 0 0 0'
            }}
          >
            Track your business miles and calculate the IRS standard mileage deduction. The current rate for 2024 is $0.67 per mile.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Mileage Input Card */}
      <Card>
        <CardHeader>
          <CardTitle 
            style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#f9fafb',
              margin: '0 0 16px 0'
            }}
          >
            Business Miles Driven
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ marginBottom: '24px' }}>
            <label 
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#f3f4f6',
                marginBottom: '8px'
              }}
            >
              Total Business Miles for Tax Year
            </label>
            <Input
              type="number"
              placeholder="Enter total business miles"
              value={businessMiles}
              onChange={(e) => setBusinessMiles(e.target.value)}
              style={{
                backgroundColor: '#374151',
                border: '1px solid #4b5563',
                color: '#f9fafb'
              }}
            />
          </div>

          {/* Calculation Display */}
          {businessMiles && parseInt(businessMiles) > 0 && (
            <div 
              style={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '24px'
              }}
            >
              <h4 
                style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#f9fafb',
                  marginBottom: '12px'
                }}
              >
                Deduction Calculation
              </h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#d1d5db' }}>Business Miles:</span>
                <span style={{ color: '#f9fafb', fontWeight: '500' }}>{parseInt(businessMiles).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#d1d5db' }}>IRS Rate (2024):</span>
                <span style={{ color: '#f9fafb', fontWeight: '500' }}>$0.67 per mile</span>
              </div>
              <div 
                style={{
                  borderTop: '1px solid #374151',
                  paddingTop: '8px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}
              >
                <span style={{ color: '#d1d5db', fontWeight: '600' }}>Total Deduction:</span>
                <span 
                  style={{
                    color: '#10b981',
                    fontWeight: '700',
                    fontSize: '18px'
                  }}
                >
                  ${(parseInt(businessMiles) * 0.67).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          <Button
            onClick={saveMileageData}
            disabled={mileageSaving}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontWeight: '500'
            }}
          >
            {mileageSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              'Save Mileage Data'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle 
            style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#f9fafb',
              margin: '0 0 12px 0'
            }}
          >
            📋 Important Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul 
            style={{
              color: '#d1d5db',
              fontSize: '14px',
              lineHeight: '1.6',
              listStyle: 'disc',
              paddingLeft: '20px'
            }}
          >
            <li>The IRS standard mileage rate for 2024 is $0.67 per mile for business use</li>
            <li>Keep detailed records of your business trips including dates, destinations, and business purposes</li>
            <li>This deduction is separate from your car and truck expenses on Line 9</li>
            <li>You must choose between the standard mileage rate or actual expenses - you cannot use both</li>
            <li>The 2025 rate increases to $0.70 per mile starting January 1, 2025</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )

  const renderHomeOffice = () => (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle 
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#f9fafb',
              margin: '0'
            }}
          >
            🏠 Home Office Deduction
          </CardTitle>
          <CardDescription 
            style={{
              color: '#9ca3af',
              fontSize: '14px',
              margin: '8px 0 0 0'
            }}
          >
            Calculate your home office deduction using either the simplified method ($5 per sq ft) or actual expense method.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Method Selection Card */}
      <Card>
        <CardHeader>
          <CardTitle 
            style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#f9fafb',
              margin: '0 0 16px 0'
            }}
          >
            Calculation Method
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ marginBottom: '24px' }}>
            <label 
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '12px',
                cursor: 'pointer'
              }}
            >
              <input
                type="radio"
                checked={useSimplified}
                onChange={() => setUseSimplified(true)}
                style={{
                  marginRight: '8px',
                  accentColor: '#3b82f6'
                }}
              />
              <span style={{ color: '#f9fafb', fontWeight: '500' }}>
                Simplified Method ($5 per square foot, max 300 sq ft)
              </span>
            </label>
            <label 
              style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer'
              }}
            >
              <input
                type="radio"
                checked={!useSimplified}
                onChange={() => setUseSimplified(false)}
                style={{
                  marginRight: '8px',
                  accentColor: '#3b82f6'
                }}
              />
              <span style={{ color: '#f9fafb', fontWeight: '500' }}>
                Actual Expense Method (percentage of home expenses)
              </span>
            </label>
          </div>

          {/* Home Office Square Footage */}
          <div style={{ marginBottom: '24px' }}>
            <label 
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#f3f4f6',
                marginBottom: '8px'
              }}
            >
              Home Office Square Footage
            </label>
            <Input
              type="number"
              placeholder="Enter home office square footage"
              value={homeOfficeSqft}
              onChange={(e) => setHomeOfficeSqft(e.target.value)}
              style={{
                backgroundColor: '#374151',
                border: '1px solid #4b5563',
                color: '#f9fafb'
              }}
            />
          </div>

          {/* Total Home Square Footage - only for actual expense method */}
          {!useSimplified && (
            <div style={{ marginBottom: '24px' }}>
              <label 
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#f3f4f6',
                  marginBottom: '8px'
                }}
              >
                Total Home Square Footage
              </label>
              <Input
                type="number"
                placeholder="Enter total home square footage"
                value={totalHomeSqft}
                onChange={(e) => setTotalHomeSqft(e.target.value)}
                style={{
                  backgroundColor: '#374151',
                  border: '1px solid #4b5563',
                  color: '#f9fafb'
                }}
              />
            </div>
          )}

          {/* Calculation Display */}
          {homeOfficeSqft && parseInt(homeOfficeSqft) > 0 && (
            <div 
              style={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '24px'
              }}
            >
              <h4 
                style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#f9fafb',
                  marginBottom: '12px'
                }}
              >
                Deduction Calculation
              </h4>
              
              {useSimplified ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#d1d5db' }}>Home Office Sq Ft:</span>
                    <span style={{ color: '#f9fafb', fontWeight: '500' }}>{parseInt(homeOfficeSqft)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#d1d5db' }}>Simplified Rate:</span>
                    <span style={{ color: '#f9fafb', fontWeight: '500' }}>$5 per sq ft</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#d1d5db' }}>Max Deductible Sq Ft:</span>
                    <span style={{ color: '#f9fafb', fontWeight: '500' }}>
                      {Math.min(parseInt(homeOfficeSqft), 300)} sq ft
                    </span>
                  </div>
                  <div 
                    style={{
                      borderTop: '1px solid #374151',
                      paddingTop: '8px',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span style={{ color: '#d1d5db', fontWeight: '600' }}>Total Deduction:</span>
                    <span 
                      style={{
                        color: '#10b981',
                        fontWeight: '700',
                        fontSize: '18px'
                      }}
                    >
                      ${(Math.min(parseInt(homeOfficeSqft), 300) * 5).toFixed(2)}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  {totalHomeSqft && parseInt(totalHomeSqft) > 0 ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: '#d1d5db' }}>Home Office Sq Ft:</span>
                        <span style={{ color: '#f9fafb', fontWeight: '500' }}>{parseInt(homeOfficeSqft)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: '#d1d5db' }}>Total Home Sq Ft:</span>
                        <span style={{ color: '#f9fafb', fontWeight: '500' }}>{parseInt(totalHomeSqft)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: '#d1d5db' }}>Percentage:</span>
                        <span style={{ color: '#f9fafb', fontWeight: '500' }}>
                          {((parseInt(homeOfficeSqft) / parseInt(totalHomeSqft)) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div 
                        style={{
                          borderTop: '1px solid #374151',
                          paddingTop: '8px',
                          color: '#d1d5db',
                          fontSize: '14px'
                        }}
                      >
                        Apply this percentage to your qualifying home expenses (mortgage interest, property taxes, utilities, insurance, repairs, etc.)
                      </div>
                    </>
                  ) : (
                    <div style={{ color: '#f59e0b', fontSize: '14px' }}>
                      Please enter total home square footage to calculate the percentage
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <Button
            onClick={saveHomeOfficeData}
            disabled={homeOfficeSaving}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontWeight: '500'
            }}
          >
            {homeOfficeSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              'Save Home Office Data'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle 
            style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#f9fafb',
              margin: '0 0 12px 0'
            }}
          >
            📋 Important Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul 
            style={{
              color: '#d1d5db',
              fontSize: '14px',
              lineHeight: '1.6',
              listStyle: 'disc',
              paddingLeft: '20px'
            }}
          >
            <li><strong>Simplified Method:</strong> Easier to calculate, $5 per square foot up to 300 sq ft maximum ($1,500 max deduction)</li>
            <li><strong>Actual Expense Method:</strong> May provide larger deduction but requires detailed record keeping</li>
            <li>Your home office must be used regularly and exclusively for business purposes</li>
            <li>For actual expenses, keep records of mortgage interest, property taxes, utilities, insurance, repairs, and depreciation</li>
            <li>You cannot use both methods in the same year</li>
            <li>This data will be included in your Schedule C export for CPA review</li>
          </ul>
        </CardContent>
      </Card>
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
      case "recurring":
        return renderRecurring()
      case "mileage":
        return renderMileage()
      case "homeoffice":
        return renderHomeOffice()
      case "export":
        return renderExport()
      default:
        return renderUpload()
    }
  }

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <div className="w-72 bg-gray-800 border-r border-gray-700 flex flex-col flex-shrink-0">
        {/* Logo - HIDDEN */}
        <div className="sidebar-logo p-4 border-b border-gray-700 bg-gradient-to-r from-gray-800 to-gray-900">
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
            className={`sidebar-nav-button ${
              activeTab === "upload" ? "active" : ""
            } text-gray-300`}
          >
            <Upload className="h-4 w-4" />
            <span className="text-sm font-medium">Upload</span>
            {activeTab === "upload" && <ChevronRight className="h-3 w-3 ml-auto" />}
          </button>

          <button
            onClick={() => setActiveTab("transactions")}
            className={`sidebar-nav-button ${
              activeTab === "transactions" ? "active" : ""
            } text-gray-300`}
          >
            <Receipt className="h-4 w-4" />
            <span className="text-sm font-medium">Transactions</span>
            {activeTab === "transactions" && <ChevronRight className="h-3 w-3 ml-auto" />}
          </button>

          <button
            onClick={() => setActiveTab("recurring")}
            className={`sidebar-nav-button ${
              activeTab === "recurring" ? "active" : ""
            } text-gray-300`}
          >
            <RefreshCw className="h-4 w-4" />
            <span className="text-sm font-medium">Recurring</span>
            {activeTab === "recurring" && <ChevronRight className="h-3 w-3 ml-auto" />}
          </button>

          <button
            onClick={() => setActiveTab("mileage")}
            className={`sidebar-nav-button ${
              activeTab === "mileage" ? "active" : ""
            } text-gray-300`}
          >
            <CreditCard className="h-4 w-4" />
            <span className="text-sm font-medium">Mileage</span>
            {activeTab === "mileage" && <ChevronRight className="h-3 w-3 ml-auto" />}
          </button>

          <button
            onClick={() => setActiveTab("homeoffice")}
            className={`sidebar-nav-button ${
              activeTab === "homeoffice" ? "active" : ""
            } text-gray-300`}
          >
            <Settings className="h-4 w-4" />
            <span className="text-sm font-medium">Home Office</span>
            {activeTab === "homeoffice" && <ChevronRight className="h-3 w-3 ml-auto" />}
          </button>

          <button
            onClick={() => setActiveTab("overview")}
            className={`sidebar-nav-button ${
              activeTab === "overview" ? "active" : ""
            } text-gray-300`}
          >
            <BarChart3 className="h-4 w-4" />
            <span className="text-sm font-medium">Overview</span>
            {activeTab === "overview" && <ChevronRight className="h-3 w-3 ml-auto" />}
          </button>



          <button
            onClick={() => setActiveTab("export")}
            className={`sidebar-nav-button ${
              activeTab === "export" ? "active" : ""
            } text-gray-300`}
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
        <header className="h-28 border-b border-gray-700 bg-gray-800 px-8 flex items-center justify-center sticky top-0 z-10 relative">
          <div className="header-content">
            <p className="schedule-c-brand">Schedule C Assistant</p>
            <h1 className="header-title">
              {activeTab === "upload" && "Upload CSV Files"}
              {activeTab === "overview" && "Overview"}
              {activeTab === "transactions" && "Transactions"}
              {activeTab === "recurring" && "Recurring Transactions"}
              {activeTab === "mileage" && "Business Mileage Deduction"}
              {activeTab === "homeoffice" && "Home Office Deduction"}
              {activeTab === "categories" && "Categories"}
              {activeTab === "export" && "Export"}
            </h1>
            <p className="header-subtitle">
              {activeTab === "upload" && "Import your bank statements and credit card transactions"}
              {activeTab === "overview" && "Financial summary and key metrics"}
              {activeTab === "transactions" && "Review and manage your transactions"}
              {activeTab === "recurring" && "Manage recurring transactions and bulk actions"}
              {activeTab === "mileage" && "Track business miles for standard mileage deduction"}
              {activeTab === "homeoffice" && "Calculate home office deduction"}
              {activeTab === "categories" && "Expense breakdown by category"}
              {activeTab === "export" && "Download reports and tax forms"}
            </p>
          </div>
          
          {/* Delete All Data Button - Positioned Absolutely */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              console.log('🗑️ Trash can clicked - opening delete modal')
              setShowClearDataModal(true)
            }}
            className="border-gray-600 text-gray-300 hover:bg-red-700 hover:text-white hover:border-red-600 absolute top-4 right-8"
            title="Delete all data"
          >
            <Trash className="h-4 w-4" />
          </Button>
        </header>

        {/* NUCLEAR CSS OVERRIDE - UI Improvements v3.9 - Transparent Trash Button 11:48 */}
        <style dangerouslySetInnerHTML={{
          __html: `
            /* Hero Numbers Section */
            .force-hero-container {
              padding: 32px !important;
              background: linear-gradient(135deg, #1f2937 0%, #111827 50%, #000000 100%) !important;
              border-bottom: 1px solid #374151 !important;
              font-family: system-ui, -apple-system, sans-serif !important;
              display: block !important;
              width: 100% !important;
              box-sizing: border-box !important;
            }
            .force-hero-title {
              font-size: 14px !important;
              font-weight: 600 !important;
              color: #9ca3af !important;
              text-transform: uppercase !important;
              letter-spacing: 0.1em !important;
              margin-bottom: 16px !important;
              display: block !important;
              text-align: center !important;
            }
            .force-hero-amount {
              font-size: 72px !important;
              font-weight: bold !important;
              background: linear-gradient(90deg, #34d399 0%, #10b981 50%, #059669 100%) !important;
              -webkit-background-clip: text !important;
              -webkit-text-fill-color: transparent !important;
              background-clip: text !important;
              margin-bottom: 16px !important;
              line-height: 1.1 !important;
              display: block !important;
              text-align: center !important;
            }
            .force-hero-stats {
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              gap: 24px !important;
              font-size: 14px !important;
              color: #9ca3af !important;
            }
            
            /* Lighter Background Override */
            .bg-gray-900 {
              background-color: #374151 !important; /* Much lighter gray */
            }
            .bg-gray-800 {
              background-color: #4b5563 !important; /* Lighter sidebar */
            }
            
            /* Sidebar Navigation - Twice as Long */
            .sidebar-nav-button {
              padding: 16px 12px !important; /* Double the vertical padding (was 8px) */
              margin-bottom: 4px !important;
              border-radius: 8px !important;
              width: 100% !important;
              display: flex !important;
              align-items: center !important;
              gap: 8px !important;
              transition: all 0.2s ease !important;
              font-size: 14px !important;
              font-weight: 500 !important;
            }
            .sidebar-nav-button:hover {
              background-color: rgba(107, 114, 128, 0.5) !important;
            }
            .sidebar-nav-button.active {
              background: linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%) !important;
              color: white !important;
              box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3) !important;
            }
            
            /* Hide Schedule C Assistant Title and Icon */
            .sidebar-logo {
              display: none !important;
            }
            
            /* FORCE SIDEBAR WIDTH OVERRIDE */
            .w-72 {
              width: 288px !important; /* Force wider sidebar */
            }
            
            /* FORCE HEADER HEIGHT OVERRIDE */
            .h-28 {
              height: 134px !important; /* 20% bigger: 112px * 1.2 = 134px */
            }
            
            /* Center Header Text */
            .header-content {
              text-align: center !important;
              width: 100% !important;
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              justify-content: center !important;
            }
            .schedule-c-brand {
              font-size: 18px !important; /* 20% bigger: 15px * 1.2 = 18px */
              font-weight: bold !important; /* Very bold */
              color: #ffffff !important; /* Very white */
              text-transform: uppercase !important;
              letter-spacing: 0.1em !important;
              margin-bottom: -2px !important; /* Even closer - negative margin */
              text-align: center !important;
              display: block !important;
            }
            .header-title {
              font-size: 31px !important; /* 20% bigger: 26px * 1.2 = 31px */
              font-weight: bold !important; /* Very bold */
              color: #ffffff !important; /* Very white */
              margin-bottom: -4px !important; /* Even closer - negative margin */
              text-align: center !important;
            }
            .header-subtitle {
              font-size: 22px !important; /* 20% bigger: 18px * 1.2 = 22px */
              font-weight: bold !important; /* Very bold */
              color: #ffffff !important; /* Very white */
              text-align: center !important;
              max-width: 720px !important; /* 20% bigger: 600px * 1.2 = 720px */
              line-height: 1.1 !important; /* Even tighter line height */
            }
            
            /* FORCE TRASH BUTTON POSITIONING AND STYLING - WHITE ICON WITH TEXT */
            header .absolute.top-4.right-8 {
              position: absolute !important;
              top: 20px !important; /* Adjusted for bigger header */
              right: 32px !important;
              z-index: 50 !important;
              background: transparent !important; /* White transparent background */
              border: none !important; /* Remove border */
              backdrop-filter: none !important; /* Remove any backdrop effects */
              color: #ffffff !important; /* Force white icon */
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              gap: 4px !important;
              padding: 8px 6px !important;
            }
            header .absolute.top-4.right-8:hover {
              background: rgba(239, 68, 68, 0.2) !important; /* Light red hover */
              border: 1px solid rgba(239, 68, 68, 0.5) !important; /* Red border on hover */
              color: #ffffff !important; /* Keep white on hover */
            }
            header .absolute.top-4.right-8 svg {
              color: #ffffff !important; /* Force white SVG */
              fill: #ffffff !important; /* Force white fill */
              stroke: #ffffff !important; /* Force white stroke */
            }
            header .absolute.top-4.right-8::after {
              content: "Delete All" !important;
              font-size: 10px !important;
              color: #ffffff !important;
              font-weight: 500 !important;
              text-align: center !important;
              line-height: 1 !important;
              white-space: nowrap !important;
            }
            
            /* TRANSACTION ROW HOVER HIGHLIGHTING */
            tbody tr:hover {
              background-color: rgba(59, 130, 246, 0.15) !important; /* Light blue highlight */
              transform: translateY(-1px) !important; /* Subtle lift effect */
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important; /* Enhanced shadow */
              transition: all 0.2s ease !important;
            }
            tbody tr {
              transition: all 0.2s ease !important;
            }
            
            /* CENTER SCHEDULE C EXPORT HEADER */
            .space-y-6 > .flex.items-center.justify-between > div:first-child {
              text-align: center !important;
              width: 100% !important;
            }
            .space-y-6 > .flex.items-center.justify-between > div:first-child h2 {
              text-align: center !important;
              margin: 0 auto !important;
            }
            .space-y-6 > .flex.items-center.justify-between > div:first-child p {
              text-align: center !important;
              margin: 0 auto !important;
            }
            .space-y-6 > .flex.items-center.justify-between {
              position: relative !important;
            }
            .space-y-6 > .flex.items-center.justify-between > div:last-child {
              position: absolute !important;
              right: 0 !important;
              top: 50% !important;
              transform: translateY(-50%) !important;
            }
          `
        }} />
        
        {/* Hero Numbers Section - FORCED STYLING */}
        {hasData && businessSummary && (
          <div className="force-hero-container">
                         <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
               <div style={{ textAlign: 'center' }}>
                 <p className="force-hero-title">
                   Total Business Deductions
                 </p>
                 <div className="force-hero-amount">
                   {formatCurrency(businessSummary.business_expenses)}
                 </div>
                 <div className="force-hero-stats">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ 
                      width: '8px', 
                      height: '8px', 
                      backgroundColor: '#34d399 !important', 
                      borderRadius: '50%',
                      boxShadow: '0 0 10px rgba(52, 211, 153, 0.5)'
                    }}></div>
                    <span style={{ color: '#d1d5db !important', fontWeight: '500' }}>
                      {businessSummary.business_transactions} business transactions
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ 
                      width: '8px', 
                      height: '8px', 
                      backgroundColor: '#9ca3af !important', 
                      borderRadius: '50%' 
                    }}></div>
                    <span style={{ color: '#d1d5db !important', fontWeight: '500' }}>
                      {businessSummary.personal_transactions} personal transactions
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calculator style={{ width: '16px', height: '16px', color: '#60a5fa !important' }} />
                    <span style={{ color: '#60a5fa !important', fontWeight: '600' }}>Ready for Schedule C</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto px-8 py-6 bg-gradient-to-b from-gray-900 to-gray-950">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Clear Data Modal - Complete CSS Override */}
      {showClearDataModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '400px',
              width: '90%',
              margin: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e5e5e5'
            }}
          >
            <h2
              style={{
                fontSize: '20px',
                fontWeight: 'bold',
                color: '#111827',
                marginBottom: '16px',
                margin: 0
              }}
            >
              Delete All Data
            </h2>
            <p
              style={{
                color: '#374151',
                marginBottom: '24px',
                lineHeight: '1.5',
                margin: '0 0 24px 0'
              }}
            >
              Are you sure you want to delete all data? This action cannot be undone and will remove:
            </p>
            <ul
              style={{
                color: '#374151',
                marginBottom: '24px',
                marginLeft: '20px',
                lineHeight: '1.6'
              }}
            >
              <li>All transactions</li>
              <li>All uploaded CSV files</li>
              <li>All vendor rules</li>
              <li>All deduction data</li>
            </ul>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px'
              }}
            >
              <button
                onClick={() => setShowClearDataModal(false)}
                disabled={clearingData}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: clearingData ? 'not-allowed' : 'pointer',
                  opacity: clearingData ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!clearingData) {
                    e.currentTarget.style.backgroundColor = '#f9fafb'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!clearingData) {
                    e.currentTarget.style.backgroundColor = '#ffffff'
                  }
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllData}
                disabled={clearingData}
                style={{
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: clearingData ? 'not-allowed' : 'pointer',
                  opacity: clearingData ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  if (!clearingData) {
                    e.currentTarget.style.backgroundColor = '#b91c1c'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!clearingData) {
                    e.currentTarget.style.backgroundColor = '#dc2626'
                  }
                }}
              >
                {clearingData ? (
                  <>
                    <svg 
                      style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} 
                      fill="none" 
                      viewBox="0 0 24 24"
                    >
                      <circle 
                        style={{ opacity: 0.25 }} 
                        cx="12" 
                        cy="12" 
                        r="10" 
                        stroke="currentColor" 
                        strokeWidth="4"
                      />
                      <path 
                        style={{ opacity: 0.75 }} 
                        fill="currentColor" 
                        d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Delete All Data'
                )}
              </button>
            </div>
          </div>
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* Progress Modal */}
      {renderCategorizationModal()}

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
        >
          <div
            style={{
              backgroundColor: '#1f2937',
              borderRadius: '12px',
              padding: '32px',
              maxWidth: '480px',
              width: '90%',
              margin: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              border: '1px solid #374151'
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: '24px' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '64px',
                    height: '64px',
                    backgroundColor: '#7c3aed',
                    borderRadius: '50%',
                    marginBottom: '16px'
                  }}
                >
                  🤖
                </div>
                <h3
                  style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: '#f9fafb',
                    marginBottom: '8px',
                    margin: '0 0 8px 0'
                  }}
                >
                  OpenRouter API Key Required
                </h3>
                <p
                  style={{
                    color: '#9ca3af',
                    fontSize: '14px',
                    marginBottom: '16px',
                    margin: '0 0 16px 0'
                  }}
                >
                  To use AI categorization, please enter your OpenRouter API key. Get one free at{' '}
                  <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" style={{ color: '#7c3aed' }}>
                    openrouter.ai
                  </a>
                </p>
              </div>

              <div style={{ marginBottom: '24px', textAlign: 'left' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#f3f4f6',
                    marginBottom: '8px'
                  }}
                >
                  OpenRouter API Key
                </label>
                <input
                  type="password"
                  placeholder="sk-or-v1-..."
                  value={openRouterApiKey}
                  onChange={(e) => setOpenRouterApiKey(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '14px',
                    backgroundColor: '#374151',
                    border: '1px solid #4b5563',
                    borderRadius: '6px',
                    color: '#f9fafb',
                    fontFamily: 'monospace'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => setShowApiKeyModal(false)}
                  style={{
                    padding: '12px 24px',
                    fontSize: '14px',
                    fontWeight: '500',
                    backgroundColor: '#374151',
                    color: '#f9fafb',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (openRouterApiKey.trim()) {
                      triggerManualCategorization()
                    } else {
                      alert('Please enter a valid API key')
                    }
                  }}
                  disabled={!openRouterApiKey.trim()}
                  style={{
                    padding: '12px 24px',
                    fontSize: '14px',
                    fontWeight: '500',
                    backgroundColor: openRouterApiKey.trim() ? '#7c3aed' : '#4b5563',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: openRouterApiKey.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  Start AI Categorization
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
