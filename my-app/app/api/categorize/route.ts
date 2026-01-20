/**
 * API Route: /api/categorize
 * 
 * This serverless function proxies requests to OpenRouter's LLM API.
 * It keeps the API key secure on the server side.
 * 
 * For static export deployments, this route won't be available.
 * In that case, the client-side implementation in client-storage.ts
 * is used with a user-provided API key.
 */

import { NextRequest, NextResponse } from 'next/server';

// IRS Schedule C categories for categorization
const SCHEDULE_C_CATEGORIES = `
REQUIRED CATEGORIES (use exact names):
- Line 8: "Advertising"
- Line 9: "Car and truck"
- Line 10: "Commissions and fees"
- Line 11: "Contractors"
- Line 15: "Insurance"
- Line 16: "Interest paid"
- Line 17: "Legal fees and professional services"
- Line 18: "Office expenses"
- Line 20: "Rent and lease"
- Line 21: "Repairs and maintenance"
- Line 22: "Supplies"
- Line 23: "Taxes and licenses"
- Line 24: "Meals"
- Line 25: "Travel expenses"
- Line 26: "Utilities"
- Line 27: "Other business expenses"
`;

interface Transaction {
  id: string;
  vendor: string;
  amount: number;
  date: string;
}

interface CategorizationRequest {
  transactions: Transaction[];
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export async function POST(request: NextRequest) {
  try {
    // Get API key from environment (server-side only, not exposed to client)
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'MISSING_API_KEY', 
            message: 'OpenRouter API key not configured on server' 
          } 
        },
        { status: 500 }
      );
    }

    const body: CategorizationRequest = await request.json();
    
    if (!body.transactions || !Array.isArray(body.transactions)) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INVALID_REQUEST', 
            message: 'transactions array is required' 
          } 
        },
        { status: 400 }
      );
    }

    if (body.transactions.length === 0) {
      return NextResponse.json({
        success: true,
        results: [],
        processed: 0
      });
    }

    // Build the categorization prompt
    const transactionList = body.transactions
      .map((t, i) => `${i + 1}. Vendor: ${t.vendor}, Amount: $${t.amount}, Date: ${t.date}`)
      .join('\n');

    const prompt = `You are an expert tax accountant. Categorize these business transactions for IRS Schedule C.

Transactions:
${transactionList}

${SCHEDULE_C_CATEGORIES}

For EACH transaction, respond with a JSON array containing objects with:
- id: the transaction number (1, 2, 3, etc.)
- category: the exact category name from the list above
- schedule_c_line: the IRS Schedule C line number
- purpose: brief business purpose description

Respond with ONLY valid JSON array, no explanation.`;

    // Call OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.SITE_URL || 'https://schedule-c-calculator.app',
        'X-Title': 'Schedule C Calculator',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'LLM_ERROR', 
            message: 'AI categorization service temporarily unavailable',
            details: response.status.toString()
          } 
        },
        { status: 502 }
      );
    }

    const llmResponse: OpenRouterResponse = await response.json();
    
    if (!llmResponse.choices || llmResponse.choices.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'LLM_ERROR', 
            message: 'No response from AI service' 
          } 
        },
        { status: 502 }
      );
    }

    // Parse the LLM response
    let content = llmResponse.choices[0].message.content.trim();
    
    // Remove markdown code blocks if present
    if (content.startsWith('```json')) {
      content = content.slice(7);
    }
    if (content.startsWith('```')) {
      content = content.slice(3);
    }
    if (content.endsWith('```')) {
      content = content.slice(0, -3);
    }
    content = content.trim();

    try {
      const results = JSON.parse(content);
      
      // Map results back to transaction IDs
      const mappedResults = body.transactions.map((transaction, index) => {
        const result = results.find((r: any) => r.id === index + 1) || {};
        return {
          transaction_id: transaction.id,
          category: result.category || 'Other business expenses',
          schedule_c_line: result.schedule_c_line || 27,
          purpose: result.purpose || '',
        };
      });

      return NextResponse.json({
        success: true,
        results: mappedResults,
        processed: mappedResults.length
      });
    } catch (parseError) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'PARSE_ERROR', 
            message: 'Failed to parse AI response' 
          } 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: 'An unexpected error occurred' 
        } 
      },
      { status: 500 }
    );
  }
}
