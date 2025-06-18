import { clientStorage, llmCategorization, Transaction, DeductionData } from './client-storage';

// Client-side API that replaces backend calls
export const clientApi = {
  // Transaction operations
  async get(endpoint: string) {
    if (endpoint.startsWith('/transactions')) {
      // Handle transactions with query parameters
      const transactions = await clientStorage.getTransactions();
      return {
        transactions: transactions,
        total: transactions.length,
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
        const transactionsToCategorize = await clientStorage.getTransactions();
        const categorized = await llmCategorization.categorizeTransactions(
          transactionsToCategorize, 
          data.api_key
        );
        await clientStorage.saveTransactions(categorized);
        return { success: true };

      default:
        throw new Error(`Unknown endpoint: ${endpoint}`);
    }
  },

  async delete(endpoint: string) {
    switch (endpoint) {
      case '/transactions':
        await clientStorage.deleteAllTransactions();
        return { success: true };
      default:
        throw new Error(`Unknown endpoint: ${endpoint}`);
    }
  },

  // CSV Upload - now processes files in browser
  async uploadCSV(file: File, source: string) {
    try {
      const result = await clientStorage.processCSVFile(file, source);
      await clientStorage.addTransactions(result.transactions);
      
      return {
        success: true,
        transactions_added: result.parsed,
        total_rows: result.total,
        message: `Successfully processed ${result.parsed} transactions from ${file.name}`
      };
    } catch (error) {
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