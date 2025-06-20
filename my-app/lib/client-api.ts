import { clientStorage, llmCategorization, Transaction, DeductionData } from './client-storage';

// Client-side API that replaces backend calls
export const clientApi = {
  // Transaction operations
  async get(endpoint: string) {
    if (endpoint.startsWith('/transactions')) {
      // Handle transactions with query parameters
      const allTransactions = await clientStorage.getTransactions();
      console.log(`🔍 DEBUG: Loading transactions from LocalForage. Found ${allTransactions.length} transactions:`, allTransactions.slice(0, 3));
      
      // Parse query parameters from endpoint
      const url = new URL(`http://localhost${endpoint}`);
      const searchParams = url.searchParams;
      
      let filteredTransactions = [...allTransactions];
      
      // Apply filters
      const search = searchParams.get('search');
      if (search) {
        const searchLower = search.toLowerCase();
        filteredTransactions = filteredTransactions.filter(t => 
          t.vendor.toLowerCase().includes(searchLower) ||
          (t.category && t.category.toLowerCase().includes(searchLower))
        );
      }
      
      const card = searchParams.get('card');
      if (card && card !== 'all') {
        filteredTransactions = filteredTransactions.filter(t => t.source === card);
      }
      
      const type = searchParams.get('type');
      if (type && type !== 'all') {
        if (type === 'business') {
          filteredTransactions = filteredTransactions.filter(t => t.is_business);
        } else if (type === 'personal') {
          filteredTransactions = filteredTransactions.filter(t => !t.is_business);
        }
      }
      
      const category = searchParams.get('category');
      if (category && category !== 'all') {
        filteredTransactions = filteredTransactions.filter(t => t.category === category);
      }
      
      // Apply sorting
      const sortBy = searchParams.get('sortBy') || 'date';
      const sortOrder = searchParams.get('sortOrder') || 'desc';
      
      filteredTransactions.sort((a, b) => {
        let aValue, bValue;
        
        switch (sortBy) {
          case 'amount':
            aValue = a.amount;
            bValue = b.amount;
            break;
          case 'vendor':
            aValue = a.vendor.toLowerCase();
            bValue = b.vendor.toLowerCase();
            break;
          case 'category':
            aValue = (a.category || '').toLowerCase();
            bValue = (b.category || '').toLowerCase();
            break;
          case 'business':
            aValue = a.is_business ? 1 : 0;
            bValue = b.is_business ? 1 : 0;
            break;
          case 'date':
          default:
            aValue = new Date(a.date).getTime();
            bValue = new Date(b.date).getTime();
            break;
        }
        
        if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
      
      // Apply pagination
      const page = parseInt(searchParams.get('page') || '1');
      const pageSize = parseInt(searchParams.get('pageSize') || '50');
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);
      
      console.log(`📊 Client-side transactions query: ${allTransactions.length} total, ${filteredTransactions.length} filtered, ${paginatedTransactions.length} on page ${page}`);
      
      return {
        transactions: paginatedTransactions,
        total: filteredTransactions.length,
        success: true
      };
    }
    
    switch (endpoint) {
      case '/summary':
        const summary = await clientStorage.calculateBusinessSummary();
        return {
          success: true,
          summary: {
            expense_transactions: summary.total_count,
            income_transactions: 0,
            total_expenses: summary.total_business_expenses,
            uncategorized_transactions: 0,
            net_profit_loss: 0,
            gross_receipts: 0
          }
        };
      case '/deductions':
        return clientStorage.getDeductions();
      case '/schedule-c':
        // Generate Schedule C data from transactions and deductions
        const scheduleData = await this.generateScheduleC();
        return {
          success: true,
          ...scheduleData
        };
      default:
        throw new Error(`Unknown endpoint: ${endpoint}`);
    }
  },

  async post(endpoint: string, data: any) {
    switch (endpoint) {
      case '/toggle-business':
        await clientStorage.updateTransaction(data.transaction_id, {
          is_business: data.is_business
        });
        return { success: true };

      case '/toggle-all-business':
        const transactions = await clientStorage.getTransactions();
        let filteredTransactions = transactions;

        // Apply filters if provided
        if (data.card_filter && data.card_filter !== 'all') {
          filteredTransactions = filteredTransactions.filter(t => t.source === data.card_filter);
        }
        if (data.type_filter && data.type_filter !== 'all') {
          // Filter by business/personal type
          filteredTransactions = filteredTransactions.filter(t => 
            data.type_filter === 'business' ? t.is_business : !t.is_business
          );
        }
        if (data.id_list && Array.isArray(data.id_list)) {
          filteredTransactions = filteredTransactions.filter(t => data.id_list.includes(t.id));
        }

        // Update all filtered transactions
        for (const transaction of filteredTransactions) {
          await clientStorage.updateTransaction(transaction.id, {
            is_business: data.is_business
          });
        }
        return { success: true, updated: filteredTransactions.length };

      case '/save-mileage':
        const currentDeductions = await clientStorage.getDeductions();
        await clientStorage.saveDeductions({
          ...currentDeductions,
          mileage: {
            business_miles: data.business_miles,
            deduction_amount: data.business_miles * 0.67 // 2024 IRS rate
          }
        });
        return { success: true };

      case '/save-home-office':
        const deductions = await clientStorage.getDeductions();
        await clientStorage.saveDeductions({
          ...deductions,
          home_office: {
            square_feet: data.square_feet,
            method: data.method || 'simplified',
            deduction_amount: data.method === 'simplified' 
              ? Math.min(data.square_feet * 5, 1500) // Simplified method: $5/sqft, max $1500
              : data.actual_amount || 0
          }
        });
        return { success: true };

      case '/categorize':
        // This would require an API key to be passed
        if (!data.api_key) {
          throw new Error('API key required for categorization');
        }
        
        // Get only uncategorized business transactions
        const allTransactions = await clientStorage.getTransactions();
        const uncategorizedBusiness = allTransactions.filter(t => 
          t.is_business && (!t.category || t.category === 'uncategorized' || t.category === '')
        );
        
        if (uncategorizedBusiness.length === 0) {
          return { 
            success: true, 
            processed: 0, 
            total: 0,
            message: 'No uncategorized business transactions found' 
          };
        }
        
        console.log(`🤖 Starting AI categorization for ${uncategorizedBusiness.length} transactions...`);
        
        // Categorize only the uncategorized business transactions
        const categorized = await llmCategorization.categorizeTransactions(
          uncategorizedBusiness, 
          data.api_key
        );
        
        // Merge categorized transactions back into the full list
        const updatedTransactions = allTransactions.map(t => {
          const categorizedVersion = categorized.find(ct => ct.id === t.id);
          return categorizedVersion || t;
        });
        
        // Save all transactions
        await clientStorage.saveTransactions(updatedTransactions);
        
        // Count how many were actually categorized
        const processedCount = categorized.filter(t => 
          t.category && t.category !== '' && t.category !== 'uncategorized'
        ).length;
        
        console.log(`✅ AI categorization complete: ${processedCount} of ${uncategorizedBusiness.length} transactions categorized`);
        
        return { 
          success: true, 
          processed: processedCount,
          total: uncategorizedBusiness.length
        };

      default:
        throw new Error(`Unknown endpoint: ${endpoint}`);
    }
  },

  async delete(endpoint: string) {
    switch (endpoint) {
      case '/transactions':
        await clientStorage.deleteAllTransactions();
        return { success: true };
      case '/clear-all-data':
        // Clear all data including transactions and deductions
        await clientStorage.deleteAllTransactions();
        await clientStorage.saveDeductions({});
        return { success: true };
      default:
        throw new Error(`Unknown endpoint: ${endpoint}`);
    }
  },

  // Export functionality - client-side implementation
  async exportPDF() {
    const scheduleData = await this.generateScheduleC();
    
    // Create a simple text-based "PDF" (actually a formatted text file)
    // For a real PDF, you'd need a library like jsPDF
    const content = this.formatScheduleCForPDF(scheduleData);
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `Schedule_C_${new Date().getFullYear()}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    return { success: true };
  },

  async exportCSV() {
    const transactions = await clientStorage.getTransactions();
    const deductions = await clientStorage.getDeductions();
    
    // Create CSV content
    let csvContent = 'Date,Vendor,Amount,Card,Category,Purpose,Is Business,Type\n';
    
    transactions.forEach(transaction => {
      const escapedVendor = `"${transaction.vendor.replace(/"/g, '""')}"`;
      const escapedCategory = `"${(transaction.category || '').replace(/"/g, '""')}"`;
      const escapedPurpose = `"${(transaction.purpose || '').replace(/"/g, '""')}"`;
      
      csvContent += `${transaction.date},${escapedVendor},${transaction.amount},${transaction.source},${escapedCategory},${escapedPurpose},${transaction.is_business ? 'Yes' : 'No'},${transaction.amount >= 0 ? 'Income' : 'Expense'}\n`;
    });
    
    // Add deductions section
    csvContent += '\n\nDEDUCTIONS\n';
    csvContent += 'Type,Description,Amount\n';
    
    if (deductions.mileage?.business_miles) {
      csvContent += `Mileage,"${deductions.mileage.business_miles} business miles",${deductions.mileage.deduction_amount}\n`;
    }
    
    if (deductions.home_office?.square_feet) {
      csvContent += `Home Office,"${deductions.home_office.square_feet} sq ft (${deductions.home_office.method})",${deductions.home_office.deduction_amount}\n`;
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `Schedule_C_Details_${new Date().getFullYear()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    return { success: true };
  },

  // Generate Schedule C data from transactions and deductions
  async generateScheduleC() {
    const transactions = await clientStorage.getTransactions();
    const deductions = await clientStorage.getDeductions();
    const summary = await clientStorage.calculateBusinessSummary();
    
    // Calculate business expenses by category
    const businessTransactions = transactions.filter(t => t.is_business);
    const businessExpenses = businessTransactions.filter(t => t.amount > 0); // Expenses are positive in our system
    
    // Initialize Schedule C line items
    const scheduleC = {
      line1_gross_receipts: 0, // No income tracking yet
      line8_advertising: 0,
      line9_car_truck: deductions.mileage?.deduction_amount || 0,
      line10_commissions_fees: 0,
      line11_contract_labor: 0,
      line12_depletion: 0,
      line13_depreciation: 0,
      line14_employee_benefits: 0,
      line15_insurance: 0,
      line16_interest: 0,
      line17_legal_professional: 0,
      line18_office_expense: 0,
      line19_pension_profit: 0,
      line20_rent_lease: 0,
      line21_repairs_maintenance: 0,
      line22_supplies: 0,
      line23_taxes_licenses: 0,
      line24_travel_meals: 0,
      line25_utilities: 0,
      line26_wages: 0,
      line27_other_expenses: 0,
      line28_total_expenses: 0,
      line30_home_office: deductions.home_office?.deduction_amount || 0,
      line31_net_profit_loss: 0
    };
    
    // Map transactions to Schedule C lines based on category
    businessExpenses.forEach(transaction => {
      const amount = transaction.amount;
      
      switch (transaction.category) {
        case 'advertising':
          scheduleC.line8_advertising += amount;
          break;
        case 'insurance':
          scheduleC.line15_insurance += amount;
          break;
        case 'interest':
          scheduleC.line16_interest += amount;
          break;
        case 'professional_services':
          scheduleC.line17_legal_professional += amount;
          break;
        case 'office_supplies':
        case 'software':
          scheduleC.line18_office_expense += amount;
          break;
        case 'rent':
          scheduleC.line20_rent_lease += amount;
          break;
        case 'taxes_licenses':
          scheduleC.line23_taxes_licenses += amount;
          break;
        case 'travel':
        case 'meals':
          scheduleC.line24_travel_meals += amount;
          break;
        case 'utilities':
          scheduleC.line25_utilities += amount;
          break;
        case 'other':
        default:
          // Uncategorized or other expenses go to line 27
          scheduleC.line27_other_expenses += amount;
          break;
      }
    });
    
    // Calculate totals
    const transactionExpenseTotal = Object.keys(scheduleC)
      .filter(key => key.startsWith('line') && key !== 'line1_gross_receipts' && 
              key !== 'line28_total_expenses' && key !== 'line30_home_office' && 
              key !== 'line31_net_profit_loss')
      .reduce((sum, key) => sum + scheduleC[key as keyof typeof scheduleC], 0);
    
    scheduleC.line28_total_expenses = transactionExpenseTotal;
    scheduleC.line31_net_profit_loss = 0 - scheduleC.line28_total_expenses - scheduleC.line30_home_office;
    
    return {
      tax_year: new Date().getFullYear(),
      schedule_c: scheduleC,
      summary: {
        total_transactions: transactions.length,
        business_transactions: businessTransactions.length,
        total_deductions: scheduleC.line28_total_expenses + scheduleC.line30_home_office,
        income_transactions: 0, // No income tracking in CSV imports
        expense_transactions: businessExpenses.length,
        vehicle_miles: deductions.mileage?.business_miles || 0,
        home_office_sqft: deductions.home_office?.square_feet || 0
      },
      calculation_date: new Date().toLocaleDateString()
    };
  },

  // Format Schedule C data for text export
  formatScheduleCForPDF(scheduleData: any): string {
    const { schedule_c, tax_year } = scheduleData;
    
    return `SCHEDULE C (Form 1040) - ${tax_year}
Profit or Loss From Business

PART I - INCOME
Line 1 - Gross receipts or sales: $${schedule_c.line1_gross_receipts.toFixed(2)}

PART II - EXPENSES
Line 8 - Advertising: $${schedule_c.line8_advertising.toFixed(2)}
Line 9 - Car and truck expenses: $${schedule_c.line9_car_truck.toFixed(2)}
Line 10 - Commissions and fees: $${schedule_c.line10_commissions_fees.toFixed(2)}
Line 11 - Contract labor: $${schedule_c.line11_contract_labor.toFixed(2)}
Line 12 - Depletion: $${schedule_c.line12_depletion.toFixed(2)}
Line 13 - Depreciation: $${schedule_c.line13_depreciation.toFixed(2)}
Line 14 - Employee benefit programs: $${schedule_c.line14_employee_benefits.toFixed(2)}
Line 15 - Insurance: $${schedule_c.line15_insurance.toFixed(2)}
Line 16 - Interest: $${schedule_c.line16_interest.toFixed(2)}
Line 17 - Legal and professional services: $${schedule_c.line17_legal_professional.toFixed(2)}
Line 18 - Office expense: $${schedule_c.line18_office_expense.toFixed(2)}
Line 19 - Pension and profit-sharing plans: $${schedule_c.line19_pension_profit.toFixed(2)}
Line 20 - Rent or lease: $${schedule_c.line20_rent_lease.toFixed(2)}
Line 21 - Repairs and maintenance: $${schedule_c.line21_repairs_maintenance.toFixed(2)}
Line 22 - Supplies: $${schedule_c.line22_supplies.toFixed(2)}
Line 23 - Taxes and licenses: $${schedule_c.line23_taxes_licenses.toFixed(2)}
Line 24 - Travel and meals: $${schedule_c.line24_travel_meals.toFixed(2)}
Line 25 - Utilities: $${schedule_c.line25_utilities.toFixed(2)}
Line 26 - Wages: $${schedule_c.line26_wages.toFixed(2)}
Line 27 - Other expenses: $${schedule_c.line27_other_expenses.toFixed(2)}

Line 28 - Total expenses: $${schedule_c.line28_total_expenses.toFixed(2)}
Line 30 - Home office deduction: $${schedule_c.line30_home_office.toFixed(2)}
Line 31 - Net profit or (loss): $${schedule_c.line31_net_profit_loss.toFixed(2)}

Generated by Schedule C Calculator - ${new Date().toLocaleDateString()}
`;
  },

  // CSV Upload - now processes files in browser
  async uploadCSV(file: File, source: string) {
    try {
      console.log(`🚀 Starting CSV upload: ${file.name}, source: ${source}`);
      const result = await clientStorage.processCSVFile(file, source);
      console.log(`📝 CSV parsed: ${result.parsed} transactions from ${result.total} rows`);
      console.log(`📄 Sample transactions:`, result.transactions.slice(0, 3));
      
      await clientStorage.addTransactions(result.transactions);
      console.log(`💾 Transactions saved to LocalForage`);
      
      // Verify the transactions were saved
      const savedTransactions = await clientStorage.getTransactions();
      console.log(`✅ Verification: ${savedTransactions.length} total transactions in storage`);
      
      return {
        success: true,
        transactions_added: result.parsed,
        total_rows: result.total,
        message: `Successfully processed ${result.parsed} transactions from ${file.name}`
      };
    } catch (error) {
      console.error(`❌ CSV upload failed:`, error);
      throw new Error(`Failed to process CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  async uploadMultipleCSV(files: File[], source: string) {
    const results: Array<{ file: string; success: boolean; result?: any; error?: string }> = [];
    let totalUploaded = 0;
    let totalFailed = 0;

    for (const file of files) {
      try {
        const result = await this.uploadCSV(file, source);
        results.push({
          file: file.name,
          success: true,
          result: result
        });
        totalUploaded++;
      } catch (error) {
        results.push({
          file: file.name,
          success: false,
          error: error instanceof Error ? error.message : "Upload failed"
        });
        totalFailed++;
      }
    }

    return {
      results,
      totalUploaded,
      totalFailed
    };
  },

  // Legacy methods for compatibility
  async toggleBusiness(transactionId: string, isBusiness: boolean) {
    return this.post('/toggle-business', {
      transaction_id: transactionId,
      is_business: isBusiness,
    });
  },

  async toggleAllBusiness(isBusiness: boolean, filters?: {
    cardFilter?: string;
    typeFilter?: string;
    idList?: string[];
  }) {
    return this.post('/toggle-all-business', {
      is_business: isBusiness,
      ...(filters?.cardFilter && { card_filter: filters.cardFilter }),
      ...(filters?.typeFilter && { type_filter: filters.typeFilter }),
      ...(filters?.idList && { id_list: filters.idList }),
    });
  }
};

// For easier migration, export this as 'api' to replace the old api
export const api = clientApi; 