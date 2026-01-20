package config

import (
	"testing"
)

func TestDefaultIRSRates(t *testing.T) {
	rates := DefaultIRSRates()

	// Test 2024 IRS standard mileage rate
	if rates.StandardMileageRate != 0.67 {
		t.Errorf("StandardMileageRate = %v, want 0.67", rates.StandardMileageRate)
	}

	// Test simplified home office rate
	if rates.SimplifiedHomeOfficeRate != 5.0 {
		t.Errorf("SimplifiedHomeOfficeRate = %v, want 5.0", rates.SimplifiedHomeOfficeRate)
	}

	// Test max simplified home office sq ft
	if rates.MaxSimplifiedHomeOfficeSqft != 300 {
		t.Errorf("MaxSimplifiedHomeOfficeSqft = %v, want 300", rates.MaxSimplifiedHomeOfficeSqft)
	}

	// Test tax year
	if rates.TaxYear != 2024 {
		t.Errorf("TaxYear = %v, want 2024", rates.TaxYear)
	}
}

func TestIsValidScheduleCLine(t *testing.T) {
	tests := []struct {
		line     int
		expected bool
	}{
		{8, true},   // Advertising
		{9, true},   // Car and truck
		{15, true},  // Insurance
		{27, true},  // Other business expenses
		{30, true},  // Home office
		{0, false},  // Invalid
		{7, false},  // Below minimum
		{28, false}, // Above maximum (except 30)
		{31, false}, // Above home office line
		{-1, false}, // Negative
	}

	for _, tt := range tests {
		t.Run("", func(t *testing.T) {
			result := IsValidScheduleCLine(tt.line)
			if result != tt.expected {
				t.Errorf("IsValidScheduleCLine(%d) = %v, want %v", tt.line, result, tt.expected)
			}
		})
	}
}

func TestScheduleCLines(t *testing.T) {
	// Test that all expected categories are present
	expectedCategories := map[string]int{
		"Advertising":                        8,
		"Car and truck":                      9,
		"Insurance":                          15,
		"Office expenses":                    18,
		"Meals":                              24,
		"Other business expenses":            27,
	}

	for category, expectedLine := range expectedCategories {
		if line, ok := ScheduleCLines[category]; !ok {
			t.Errorf("Category %q not found in ScheduleCLines", category)
		} else if line != expectedLine {
			t.Errorf("ScheduleCLines[%q] = %d, want %d", category, line, expectedLine)
		}
	}
}

func TestMileageDeductionCalculation(t *testing.T) {
	rates := DefaultIRSRates()

	tests := []struct {
		miles            int
		expectedDeduction float64
	}{
		{0, 0.00},
		{100, 67.00},
		{1000, 670.00},
		{10000, 6700.00},
		{15000, 10050.00},
	}

	for _, tt := range tests {
		deduction := float64(tt.miles) * rates.StandardMileageRate
		if deduction != tt.expectedDeduction {
			t.Errorf("Mileage deduction for %d miles = %.2f, want %.2f", tt.miles, deduction, tt.expectedDeduction)
		}
	}
}

func TestSimplifiedHomeOfficeDeduction(t *testing.T) {
	rates := DefaultIRSRates()

	tests := []struct {
		sqft              int
		expectedDeduction float64
	}{
		{0, 0.00},
		{100, 500.00},
		{200, 1000.00},
		{300, 1500.00},     // Maximum
		{400, 1500.00},     // Should be capped at 300 sq ft
		{500, 1500.00},     // Should be capped at 300 sq ft
	}

	for _, tt := range tests {
		sqft := tt.sqft
		if sqft > rates.MaxSimplifiedHomeOfficeSqft {
			sqft = rates.MaxSimplifiedHomeOfficeSqft
		}
		deduction := float64(sqft) * rates.SimplifiedHomeOfficeRate
		
		if deduction != tt.expectedDeduction {
			t.Errorf("Home office deduction for %d sqft = %.2f, want %.2f", tt.sqft, deduction, tt.expectedDeduction)
		}
	}
}

func TestDefaultPaginationConfig(t *testing.T) {
	cfg := DefaultPaginationConfig()

	if cfg.DefaultPageSize != 50 {
		t.Errorf("DefaultPageSize = %d, want 50", cfg.DefaultPageSize)
	}

	if cfg.MaxPageSize != 200 {
		t.Errorf("MaxPageSize = %d, want 200", cfg.MaxPageSize)
	}

	if cfg.UnlimitedSize != 999999 {
		t.Errorf("UnlimitedSize = %d, want 999999", cfg.UnlimitedSize)
	}
}

func TestPaymentKeywords(t *testing.T) {
	if len(PaymentKeywords) == 0 {
		t.Error("PaymentKeywords is empty")
	}

	// Check that common payment keywords are included
	expectedKeywords := []string{
		"online payment",
		"autopay",
		"zelle payment",
	}

	for _, keyword := range expectedKeywords {
		found := false
		for _, pk := range PaymentKeywords {
			if pk == keyword {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("Expected keyword %q not found in PaymentKeywords", keyword)
		}
	}
}
