package csv

import (
	"testing"
	"time"
)

func TestDetectFormat(t *testing.T) {
	tests := []struct {
		name     string
		headers  []string
		expected Format
	}{
		{
			name:     "Chase format",
			headers:  []string{"Status", "Date", "Description", "Debit", "Credit"},
			expected: FormatChase,
		},
		{
			name:     "Amex format with extended details",
			headers:  []string{"Date", "Description", "Amount", "Extended Details", "Category"},
			expected: FormatAmex,
		},
		{
			name:     "Simple Amex format",
			headers:  []string{"Date", "Description", "Amount"},
			expected: FormatAmex,
		},
		{
			name:     "Generic format",
			headers:  []string{"Transaction Date", "Merchant", "Total"},
			expected: FormatGeneric,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := DetectFormat(tt.headers)
			if result != tt.expected {
				t.Errorf("DetectFormat(%v) = %v, want %v", tt.headers, result, tt.expected)
			}
		})
	}
}

func TestParseDate(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		wantYear  int
		wantMonth time.Month
		wantDay   int
		wantErr   bool
	}{
		{
			name:      "MM/DD/YYYY format",
			input:     "12/25/2024",
			wantYear:  2024,
			wantMonth: time.December,
			wantDay:   25,
			wantErr:   false,
		},
		{
			name:      "M/D/YYYY format",
			input:     "1/5/2024",
			wantYear:  2024,
			wantMonth: time.January,
			wantDay:   5,
			wantErr:   false,
		},
		{
			name:      "YYYY-MM-DD format",
			input:     "2024-06-15",
			wantYear:  2024,
			wantMonth: time.June,
			wantDay:   15,
			wantErr:   false,
		},
		{
			name:    "Invalid format",
			input:   "not a date",
			wantErr: true,
		},
		{
			name:    "Empty string",
			input:   "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseDate(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseDate(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
				return
			}
			if !tt.wantErr {
				if result.Year() != tt.wantYear || result.Month() != tt.wantMonth || result.Day() != tt.wantDay {
					t.Errorf("ParseDate(%q) = %v, want %d-%02d-%02d", tt.input, result, tt.wantYear, tt.wantMonth, tt.wantDay)
				}
			}
		})
	}
}

func TestIsPaymentTransaction(t *testing.T) {
	tests := []struct {
		name        string
		description string
		expected    bool
	}{
		{
			name:        "Online payment",
			description: "ONLINE PAYMENT - THANK YOU",
			expected:    true,
		},
		{
			name:        "AutoPay",
			description: "AUTOPAY PAYMENT",
			expected:    true,
		},
		{
			name:        "Venmo payment",
			description: "Venmo Payment to John",
			expected:    true,
		},
		{
			name:        "Regular purchase",
			description: "AMAZON MARKETPLACE",
			expected:    false,
		},
		{
			name:        "Restaurant",
			description: "CHIPOTLE MEXICAN GRILL",
			expected:    false,
		},
		{
			name:        "Gas station",
			description: "CHEVRON GAS STATION",
			expected:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsPaymentTransaction(tt.description)
			if result != tt.expected {
				t.Errorf("IsPaymentTransaction(%q) = %v, want %v", tt.description, result, tt.expected)
			}
		})
	}
}

func TestCleanVendorName(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Apple Pay prefix",
			input:    "AplPay STARBUCKS COFFEE",
			expected: "STARBUCKS COFFEE",
		},
		{
			name:     "Square prefix",
			input:    "SQC*LOCAL COFFEE SHOP",
			expected: "LOCAL COFFEE SHOP",
		},
		{
			name:     "Google prefix",
			input:    "GOOGLE *YOUTUBE PREMIUM",
			expected: "YOUTUBE PREMIUM",
		},
		{
			name:     "State code suffix",
			input:    "WALMART STORE 1234 CA",
			expected: "WALMART STORE 1234",
		},
		{
			name:     "Long vendor name truncation",
			input:    "THIS IS A VERY LONG VENDOR NAME THAT EXCEEDS THE FIFTY CHARACTER LIMIT FOR DISPLAY",
			expected: "THIS IS A VERY LONG VENDOR NAME THAT EXCEEDS THE F",
		},
		{
			name:     "Clean vendor name",
			input:    "AMAZON PRIME",
			expected: "AMAZON PRIME",
		},
		{
			name:     "Whitespace handling",
			input:    "  VENDOR NAME  ",
			expected: "VENDOR NAME",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := CleanVendorName(tt.input)
			if result != tt.expected {
				t.Errorf("CleanVendorName(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestExtractCardName(t *testing.T) {
	tests := []struct {
		name     string
		filename string
		expected string
	}{
		{
			name:     "Simple CSV",
			filename: "Chase Card.CSV",
			expected: "Chase Card",
		},
		{
			name:     "Underscore in name",
			filename: "Amex_Gold.csv",
			expected: "Amex Gold",
		},
		{
			name:     "Full path",
			filename: "/uploads/My Card Statement.csv",
			expected: "My Card Statement",
		},
		{
			name:     "No extension",
			filename: "Card Name",
			expected: "Card Name",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ExtractCardName(tt.filename)
			if result != tt.expected {
				t.Errorf("ExtractCardName(%q) = %q, want %q", tt.filename, result, tt.expected)
			}
		})
	}
}
