package validation

import (
	"testing"
)

func TestVehicleDeductionRequestValidate(t *testing.T) {
	tests := []struct {
		name    string
		request VehicleDeductionRequest
		wantErr bool
	}{
		{
			name:    "Valid miles",
			request: VehicleDeductionRequest{BusinessMiles: 1000},
			wantErr: false,
		},
		{
			name:    "Zero miles",
			request: VehicleDeductionRequest{BusinessMiles: 0},
			wantErr: false,
		},
		{
			name:    "Negative miles",
			request: VehicleDeductionRequest{BusinessMiles: -100},
			wantErr: true,
		},
		{
			name:    "Unreasonably high miles",
			request: VehicleDeductionRequest{BusinessMiles: 2000000},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.request.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestHomeOfficeDeductionRequestValidate(t *testing.T) {
	tests := []struct {
		name    string
		request HomeOfficeDeductionRequest
		wantErr bool
	}{
		{
			name: "Valid simplified",
			request: HomeOfficeDeductionRequest{
				HomeOfficeSqft: 200,
				UseSimplified:  true,
			},
			wantErr: false,
		},
		{
			name: "Valid actual method",
			request: HomeOfficeDeductionRequest{
				HomeOfficeSqft: 200,
				TotalHomeSqft:  1500,
				UseSimplified:  false,
			},
			wantErr: false,
		},
		{
			name: "Home office larger than total home",
			request: HomeOfficeDeductionRequest{
				HomeOfficeSqft: 2000,
				TotalHomeSqft:  1500,
				UseSimplified:  false,
			},
			wantErr: true,
		},
		{
			name: "Negative home office sqft",
			request: HomeOfficeDeductionRequest{
				HomeOfficeSqft: -100,
				UseSimplified:  true,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.request.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestToggleBusinessRequestValidate(t *testing.T) {
	tests := []struct {
		name    string
		request ToggleBusinessRequest
		wantErr bool
	}{
		{
			name: "Valid UUID",
			request: ToggleBusinessRequest{
				TransactionID: "550e8400-e29b-41d4-a716-446655440000",
				IsBusiness:    true,
			},
			wantErr: false,
		},
		{
			name: "Empty transaction ID",
			request: ToggleBusinessRequest{
				TransactionID: "",
				IsBusiness:    true,
			},
			wantErr: true,
		},
		{
			name: "Invalid UUID format",
			request: ToggleBusinessRequest{
				TransactionID: "not-a-uuid",
				IsBusiness:    true,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.request.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestPaginationParamsValidate(t *testing.T) {
	tests := []struct {
		name             string
		page             int
		pageSize         int
		expectedPage     int
		expectedPageSize int
	}{
		{
			name:             "Valid params",
			page:             2,
			pageSize:         50,
			expectedPage:     2,
			expectedPageSize: 50,
		},
		{
			name:             "Zero page",
			page:             0,
			pageSize:         50,
			expectedPage:     1,
			expectedPageSize: 50,
		},
		{
			name:             "Negative page",
			page:             -1,
			pageSize:         50,
			expectedPage:     1,
			expectedPageSize: 50,
		},
		{
			name:             "Page size too large",
			page:             1,
			pageSize:         1000,
			expectedPage:     1,
			expectedPageSize: 200, // Max page size
		},
		{
			name:             "Zero page size",
			page:             1,
			pageSize:         0,
			expectedPage:     1,
			expectedPageSize: 50, // Default page size
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			params := PaginationParams{Page: tt.page, PageSize: tt.pageSize}
			params.Validate()
			
			if params.Page != tt.expectedPage {
				t.Errorf("Page = %d, want %d", params.Page, tt.expectedPage)
			}
			if params.PageSize != tt.expectedPageSize {
				t.Errorf("PageSize = %d, want %d", params.PageSize, tt.expectedPageSize)
			}
		})
	}
}

func TestSanitizeFilename(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Normal filename",
			input:    "my_file.csv",
			expected: "my_file.csv",
		},
		{
			name:     "Path separators",
			input:    "../../../etc/passwd",
			expected: "_.._.._.._etc_passwd",
		},
		{
			name:     "Windows path separators",
			input:    "..\\..\\windows\\file.csv",
			expected: "_.._..__.._windows_file.csv",
		},
		{
			name:     "Special characters",
			input:    "file<>:\"|?*.csv",
			expected: "file_______.csv",
		},
		{
			name:     "Very long filename",
			input:    string(make([]byte, 300)),
			expected: string(make([]byte, 251)) + ".csv"[:0], // Will be truncated
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SanitizeFilename(tt.input)
			
			// Check that result is at most 255 characters
			if len(result) > 255 {
				t.Errorf("SanitizeFilename() result length = %d, want <= 255", len(result))
			}
			
			// Check that path separators are removed
			if tt.name == "Path separators" || tt.name == "Windows path separators" {
				if result == tt.input {
					t.Errorf("SanitizeFilename() did not sanitize path separators")
				}
			}
		})
	}
}

func TestIsValidUUID(t *testing.T) {
	tests := []struct {
		input    string
		expected bool
	}{
		{"550e8400-e29b-41d4-a716-446655440000", true},
		{"AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE", true},
		{"not-a-uuid", false},
		{"550e8400e29b41d4a716446655440000", false}, // Missing dashes
		{"", false},
		{"550e8400-e29b-41d4-a716-44665544000", false},  // Too short
		{"550e8400-e29b-41d4-a716-4466554400000", false}, // Too long
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := isValidUUID(tt.input)
			if result != tt.expected {
				t.Errorf("isValidUUID(%q) = %v, want %v", tt.input, result, tt.expected)
			}
		})
	}
}

func TestClassifyTransactionRequestValidate(t *testing.T) {
	validLine := 18 // Office expenses
	invalidLine := 50

	tests := []struct {
		name    string
		request ClassifyTransactionRequest
		wantErr bool
	}{
		{
			name: "Valid request with category",
			request: ClassifyTransactionRequest{
				TransactionID: "550e8400-e29b-41d4-a716-446655440000",
				Category:      "Office expenses",
			},
			wantErr: false,
		},
		{
			name: "Valid request with Schedule C line",
			request: ClassifyTransactionRequest{
				TransactionID: "550e8400-e29b-41d4-a716-446655440000",
				ScheduleCLine: &validLine,
			},
			wantErr: false,
		},
		{
			name: "Missing transaction ID",
			request: ClassifyTransactionRequest{
				Category: "Office expenses",
			},
			wantErr: true,
		},
		{
			name: "Invalid Schedule C line",
			request: ClassifyTransactionRequest{
				TransactionID: "550e8400-e29b-41d4-a716-446655440000",
				ScheduleCLine: &invalidLine,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.request.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
