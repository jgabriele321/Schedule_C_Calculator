
import localforage from 'localforage';
import Papa from 'papaparse';

// Initialize storage
localforage.config({
  name: 'ScheduleC-Calculator',
  storeName: 'transactions'
});

export interface Transaction {
  id: string;
  vendor: string;
  date: string;
  amount: number;
  is_business: boolean;
  category?: string;
  purpose?: string;
  source: string;
  raw_data?: any;
}

export interface DeductionData {
  mileage?: {
    business_miles: number;
    deduction_amount: number;
  };
  home_office?: {
    square_feet: number;
    method: 'simplified' | 'actual';
    deduction_amount: number;
  };
}

// Client-side storage operations
export const clientStorage = {
  // Transaction operations
  async getTransactions(): Promise<Transaction[]> {
    try {
      const transactions = await localforage.getItem<Transaction[]>('transactions') || [];
      return transactions;
    } catch (error) {
      console.error('Error loading transactions:', error);
      return [];
    }
  },

  async saveTransactions(transactions: Transaction[]): Promise<void> {
    try {
      await localforage.setItem('transactions', transactions);
    } catch (error) {
      console.error('Error saving transactions:', error);
      throw error;
    }
  },

  async addTransaction(transaction: Transaction): Promise<void> {
    const transactions = await this.getTransactions();
    transactions.push(transaction);
    await this.saveTransactions(transactions);
  },

  async addTransactions(newTransactions: Transaction[]): Promise<void> {
    const existingTransactions = await this.getTransactions();
    const allTransactions = [...existingTransactions, ...newTransactions];
    await this.saveTransactions(allTransactions);
  },

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<void> {
    const transactions = await this.getTransactions();
    const index = transactions.findIndex(t => t.id === id);
    if (index !== -1) {
      transactions[index] = { ...transactions[index], ...updates };
      await this.saveTransactions(transactions);
    }
  },

  async deleteAllTransactions(): Promise<void> {
    await localforage.setItem('transactions', []);
  },

  // Deduction operations
  async getDeductions(): Promise<DeductionData> {
    try {
      const deductions = await localforage.getItem<DeductionData>('deductions') || {};
      return deductions;
    } catch (error) {
      console.error('Error loading deductions:', error);
      return {};
    }
  },

  async saveDeductions(deductions: DeductionData): Promise<void> {
    try {
      await localforage.setItem('deductions', deductions);
    } catch (error) {
      console.error('Error saving deductions:', error);
      throw error;
    }
  },

  // CSV Processing
  async processCSVFile(file: File, source: string): Promise<{
    transactions: Transaction[];
    total: number;
    parsed: number;
  }> {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const transactions: Transaction[] = [];
            let parsed = 0;

            results.data.forEach((row: any, index: number) => {
              const transaction = this.parseCSVRow(row, source, index);
              if (transaction) {
                transactions.push(transaction);
                parsed++;
              }
            });

            resolve({
              transactions,
              total: results.data.length,
              parsed
            });
          } catch (error) {
            reject(error);
          }
        },
        error: (error) => {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        }
      });
    });
  },

  parseCSVRow(row: any, source: string, index: number): Transaction | null {
    try {
      // Handle different CSV formats
      let vendor = '';
      let date = '';
      let amount = 0;

      // Debug: log first few rows to see format
      if (index < 3) {
        console.log(`🔍 Row ${index} format:`, Object.keys(row), row);
      }

      // Check for Amount column first (Amex-style format)
      if (row.Amount && row.Date && row.Description) {
        vendor = row.Description || '';
        date = row.Date || '';
        amount = Math.abs(parseFloat(row.Amount || '0'));
        if (index < 3) console.log(`📊 Amex-style format detected: ${vendor}, $${amount}`);
      }
      // Chase format with Debit/Credit columns: Status,Date,Description,Debit,Credit
      else if (row.Description && row.Date && (row.Debit || row.Credit)) {
        vendor = row.Description || '';
        date = row.Date || '';
        const debit = parseFloat(row.Debit || '0');
        const credit = parseFloat(row.Credit || '0');
        // For expenses: debit column contains positive amounts, but we want positive amounts for expenses
        // For payments: credit column contains negative amounts, but we want to skip these anyway
        amount = debit > 0 ? debit : Math.abs(credit); // Keep expenses as positive amounts
        if (index < 3) console.log(`📊 Chase Debit/Credit format detected: ${vendor}, $${amount}`);
      }
      else {
        if (index < 3) console.log(`❌ Unknown format, skipping row ${index}`);
        return null; // Skip rows we can't parse
      }

      // Skip payments and invalid amounts
      if (amount <= 0 || vendor.toLowerCase().includes('payment')) {
        if (index < 3) console.log(`⏭️ Skipping row ${index}: amount=${amount}, vendor=${vendor}`);
        return null;
      }

      const transaction = {
        id: `${source}-${index}-${Date.now()}`,
        vendor: vendor.trim(),
        date: date.trim(),
        amount: amount,
        is_business: false, // Default to personal
        source: source,
        raw_data: row
      };
      
      if (index < 3) console.log(`✅ Created transaction ${index}:`, transaction);
      return transaction;
    } catch (error) {
      console.error('Error parsing CSV row:', error, row);
      return null;
    }
  },

  // Business summary calculation
  async calculateBusinessSummary(): Promise<{
    total_business_expenses: number;
    business_count: number;
    personal_count: number;
    total_count: number;
  }> {
    const transactions = await this.getTransactions();
    const deductions = await this.getDeductions();

    const businessTransactions = transactions.filter(t => t.is_business);
    const total_business_expenses = businessTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    // Add mileage and home office deductions
    const mileageDeduction = deductions.mileage?.deduction_amount || 0;
    const homeOfficeDeduction = deductions.home_office?.deduction_amount || 0;
    
    return {
      total_business_expenses: total_business_expenses + mileageDeduction + homeOfficeDeduction,
      business_count: businessTransactions.length,
      personal_count: transactions.length - businessTransactions.length,
      total_count: transactions.length
    };
  }
};

// LLM Categorization (direct API call)
export const llmCategorization = {
  async categorizeTransactions(transactions: Transaction[], apiKey?: string): Promise<Transaction[]> {
    if (!apiKey) {
      throw new Error('OpenRouter API key required for categorization');
    }

    console.log(`🤖 Starting AI categorization for ${transactions.length} transactions...`);
    
    // Process in batches of 5 for faster results
    const batchSize = 5;
    const categorizedTransactions = [...transactions];
    
    for (let i = 0; i < categorizedTransactions.length; i += batchSize) {
      const batch = categorizedTransactions.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(categorizedTransactions.length/batchSize)}: transactions ${i+1}-${Math.min(i+batchSize, categorizedTransactions.length)}`);
      
      // Process batch transactions concurrently (much faster!)
      const batchPromises = batch.map(async (transaction, batchIndex) => {
        try {
          const category = await this.categorizeTransaction(transaction, apiKey);
          const globalIndex = i + batchIndex;
          categorizedTransactions[globalIndex] = { ...transaction, ...category };
          console.log(`✅ Categorized: ${transaction.vendor} → ${category.is_business ? 'Business' : 'Personal'} (${category.category || 'uncategorized'})`);
        } catch (error) {
          console.error('❌ Error categorizing transaction:', transaction.vendor, error);
          // Keep original transaction if categorization fails
        }
      });
      
      await Promise.all(batchPromises);
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < categorizedTransactions.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`🎉 Completed AI categorization for ${transactions.length} transactions!`);
    return categorizedTransactions;
  },

  async categorizeTransaction(transaction: Transaction, apiKey: string): Promise<{
    category?: string;
    purpose?: string;
    is_business?: boolean;
  }> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [{
          role: 'user',
          content: `Categorize this transaction for Schedule C tax purposes:
            Vendor: ${transaction.vendor}
            Amount: $${transaction.amount}
            Date: ${transaction.date}
            
            Respond with JSON only:
            {
              "category": "one of: office_supplies, travel, meals, advertising, utilities, software, professional_services, other",
              "purpose": "brief business purpose description",
              "is_business": boolean (true if clearly business expense)
            }`
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`LLM categorization failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;
    
    try {
      return JSON.parse(content);
    } catch {
      return {}; // Return empty object if parsing fails
    }
  }
}; 