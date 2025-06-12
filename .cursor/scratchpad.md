# Schedule C Desktop Tax Assistant - Project Plan

## Background and Motivation

The project aims to build a **Schedule C Desktop Tax Assistant** to help small business owners, freelancers, and single-member LLCs:
- Upload CSV files from credit cards or bank accounts
- Automatically classify income and business expenses
- Identify recurring vendors and high-value transactions
- Collect vehicle mileage and home office deduction data
- Output IRS-compliant **Schedule C (Form 1040)**
- Generate final export as a PDF and/or a CSV summary

### Current State Analysis
- **Frontend**: Next.js application exists with a comprehensive dashboard UI already built (`my-app/` directory)
  - UI includes file upload, transaction review, deduction input, and export interfaces
  - Built with React, TypeScript, Tailwind CSS, and shadcn/ui components
  - Mock data and basic UI interactions are implemented
- **Backend**: **DOES NOT EXIST** - needs to be built from scratch
- **Sample Data**: 4 CSV files from different credit cards available for testing
- **Architecture**: Planned as Go backend with REST API (per Instructions.md)

## Key Challenges and Analysis

1. **Data Format Inconsistency**: Sample CSV files have different column formats
   - Chase: `Status,Date,Description,Debit,Credit`
   - Need to normalize multiple bank/card formats into unified Transaction structure

2. **Classification Intelligence**: Need smart categorization of transactions
   - Business vs personal expenses
   - IRS Schedule C line item mapping
   - Vendor recognition and rule application

3. **Database Integration**: Persistent SQLite database
   - Use SQLite database for transaction storage that persists across app restarts
   - Can use OpenRouter/LLM to help with complex CSV parsing if needed

4. **IRS Compliance**: Accurate Schedule C calculation
   - Proper line item mapping (Lines 1-31)
   - Current mileage rate ($0.67/mile for 2024)
   - Home office deduction calculations

5. **Export Functionality**: PDF generation and CSV export
   - Must match official Schedule C form layout
   - Include detailed transaction records for accountant review

## High-level Task Breakdown

### Phase 1: Go Backend Foundation ⏳
**Goal**: Create basic Go REST API server with CSV upload capability
- [x] **Task 1.1**: Initialize Go project structure with chi router and SQLite database
  - Success Criteria: `go run main.go` starts server on :8080, SQLite database initializes, health check endpoint responds ✅
- [x] **Task 1.2**: Implement `/upload-csv` endpoint with multipart file handling
  - Success Criteria: Can accept CSV files via POST, stores files temporarily, returns upload confirmation ✅
- [x] **Task 1.3**: Create CSV parser that normalizes different bank formats to Transaction struct
  - Success Criteria: Parses all 4 sample CSV files correctly, excludes payments, extracts vendor/date/amount, stores in SQLite ✅
- [x] **Task 1.4**: Implement `/transactions` GET endpoint with basic filtering
  - Success Criteria: Returns parsed transactions as JSON, supports query params for filtering ✅

### Phase 2: Transaction Classification System ⏳
**Goal**: Implement intelligent transaction categorization
- [x] **Task 2.1**: Build LLM-powered expense categorization system ✅
  - Success Criteria: Uses OpenRouter API to categorize transactions into business expense types (travel, meals, software, etc.) and map to Schedule C line items
- [x] **Task 2.2**: Implement `/classify` POST endpoint for manual classification updates ✅
  - Success Criteria: Updates transaction category, purpose, and expensable status
- [ ] **Task 2.3**: Create `/vendor-rule` system for automatic classification
  - Success Criteria: Saves vendor rules, auto-applies to new transactions from same vendor
- [x] **Task 2.4**: Add high-value transaction detection with configurable threshold ✅
  - Success Criteria: Filters transactions above threshold, supports dynamic threshold changes

### Phase 3: Deduction Management ⏳
**Goal**: Handle vehicle mileage and home office deductions
- [ ] **Task 3.1**: Implement `/vehicle` POST endpoint for mileage data
  - Success Criteria: Stores business miles, calculates deduction at $0.67/mile
- [ ] **Task 3.2**: Implement `/home-office` POST endpoint with simplified vs actual method
  - Success Criteria: Calculates deduction using simplified ($5/sqft, max 300) or percentage method
- [ ] **Task 3.3**: Add deduction data persistence and retrieval
  - Success Criteria: Deduction data persists between sessions, retrievable via GET endpoints

### Phase 4: Schedule C Calculation Engine ⏳
**Goal**: Generate accurate IRS Schedule C calculations
- [ ] **Task 4.1**: Implement `/summary` endpoint for Schedule C line calculations
  - Success Criteria: Correctly sums income (Line 1), categorizes expenses (Lines 8-27), includes deductions
- [ ] **Task 4.2**: Map transaction categories to specific Schedule C line items
  - Success Criteria: Accurate mapping matches IRS categories, handles edge cases
- [ ] **Task 4.3**: Calculate final profit/loss (Line 31 = Line 7 - Line 28)
  - Success Criteria: Math is accurate, handles negative values correctly

### Phase 5: Export System ⏳
**Goal**: Generate PDF and CSV exports
- [ ] **Task 5.1**: Implement `/export/pdf` endpoint using gofpdf library
  - Success Criteria: Generates PDF matching official Schedule C form layout
- [ ] **Task 5.2**: Implement `/export/csv` endpoint for detailed transaction export
  - Success Criteria: Exports all transactions with categories, includes summary totals
- [ ] **Task 5.3**: Add export validation and error handling
  - Success Criteria: Handles missing data gracefully, provides clear error messages

### Phase 6: Frontend-Backend Integration ⏳
**Goal**: Connect existing Next.js frontend to Go backend
- [ ] **Task 6.1**: Update frontend API calls to use Go backend endpoints
  - Success Criteria: All frontend functionality works with real backend data
- [ ] **Task 6.2**: Replace mock data with real API responses
  - Success Criteria: File uploads, transaction display, and calculations use backend data
- [ ] **Task 6.3**: Add error handling and loading states in frontend
  - Success Criteria: Graceful handling of API errors, proper loading indicators
- [ ] **Task 6.4**: Enhance UI/UX for better user experience
  - Success Criteria: Improved visual design, added user-friendly features, reduced technical issues

### Phase 7: Production Deployment ⏳
**Goal**: Prepare for production deployment
- [ ] **Task 7.1**: Set up production build process for Next.js frontend
  - Success Criteria: Optimized production build with proper environment configuration
- [ ] **Task 7.2**: Create Go backend production binary
  - Success Criteria: Compiled Go binary runs efficiently, handles production load
- [ ] **Task 7.3**: Database migration and backup systems
  - Success Criteria: SQLite database properly initialized, backup/restore functionality

### Phase 8: Testing and Validation ⏳
**Goal**: Comprehensive testing with real data
- [ ] **Task 8.1**: End-to-end testing with all sample CSV files
  - Success Criteria: Successfully processes all 4 sample files, generates accurate Schedule C
- [ ] **Task 8.2**: Validate calculations against IRS Schedule C instructions
  - Success Criteria: Math matches official IRS calculations, handles edge cases
- [ ] **Task 8.3**: User acceptance testing and bug fixes
  - Success Criteria: App works smoothly for typical user workflow, no critical bugs

## Project Status Board

### Sprint 1: Backend Foundation
- [ ] Initialize Go project with chi router
- [ ] Implement CSV upload endpoint
- [ ] Create CSV parser for multiple formats
- [ ] Build transactions API endpoint

### Sprint 2: Classification & Rules
- [ ] Build vendor recognition system
- [ ] Implement manual classification endpoint
- [ ] Create vendor rule engine
- [ ] Add high-value transaction filtering

### Sprint 3: Deductions & Calculations
- [ ] Vehicle mileage deduction system
- [ ] Home office deduction system  
- [ ] Schedule C calculation engine
- [ ] Line item mapping

### Sprint 4: Export & Integration
- [ ] PDF export functionality
- [ ] CSV export functionality
- [ ] Frontend-backend integration
- [ ] Error handling improvements

### Sprint 5: Production & Testing
- [ ] Production build setup
- [ ] Database migration system
- [ ] End-to-end testing
- [ ] Final validation and deployment

## Current Status / Progress Tracking

**Current Phase**: Phase 6.4 🔧 - UI/UX Enhancement & Polish
**Last Milestone**: New V0 Frontend Successfully Integrated ✅
**Progress**: 
- ✅ Phase 6.1-6.3: Frontend-Backend Integration COMPLETED
  - V0-generated professional dashboard successfully deployed
  - API connectivity working (821 transactions loading)
  - CSV transaction classification fixed (Amex Purple: 43 transactions corrected)
  - All major JavaScript errors resolved (`transactions.filter` fixed)

**SPRINT 1 PROGRESS**: Foundation & Layout Fix 🔧
- ✅ **Task 1.1**: Fix CSS compilation issues COMPLETED
  - Resolved `tailwindcss-animate` dependency issues
  - Eliminated `border-border` utility class errors
  - Frontend compiling without CSS errors
- 🔧 **Task 1.2**: Layout improvements IN PROGRESS
  - Implemented narrower sidebar (w-56 vs w-64)
  - Added sticky headers for better navigation
  - Improved table spacing and fixed-height containers
  - Better responsive design with max-width constraints

**NEXT CRITICAL PRIORITY**: Sprint 2 - Transaction Toggle System 🎯
- **User Feedback**: "Missing toggle button would make the biggest difference"
- **Core Need**: Business/Personal expense selection for co-mingled credit card data
- **Target**: Individual toggles + master "Include All" toggle

**Ready to Begin Sprint 2**: Moving to implement the critical toggle feature that transforms the user experience for small business owners with mixed personal/business expenses.

**CURRENT CRITICAL ISSUE**: UI/UX Quality & User Experience 🚨

**Problem Analysis:**
- ✅ **Technical Integration**: Backend + Frontend working perfectly
- ❌ **Visual Design**: UI described as "ugly as sin" 
- ❌ **User Experience**: Missing key user-friendly features
- ⚠️ **CSS Issues**: Still experiencing some styling problems (`border-border` errors persist)

**Assessment Questions for Planning:**

1. **Visual/Design Issues**:
   - What specific aspects look "ugly"? (Colors, layout, typography, spacing, component design?)
   - Are you looking for a more professional business/accounting software aesthetic?
   - Do you have examples of tax software UIs you like? (TurboTax, FreeTaxUSA, etc.)

2. **Missing User-Friendly Features**:
   - What key features are missing from the current UI?
   - Are you looking for: Better onboarding, progress indicators, data validation, shortcuts, tooltips?
   - Should we focus on: Upload experience, transaction review workflow, or export process?

3. **Workflow & Usability**:
   - What's the ideal user journey? (Upload → Review → Categorize → Export?)
   - Are there pain points in the current flow that frustrate users?
   - Do we need bulk editing, smart filters, or automation features?

4. **Technical Constraints**:
   - Should we fix the existing V0 components or start fresh?
   - Are you open to using a different UI library (Material-UI, Ant Design) or stick with shadcn/ui?
   - Do we need mobile responsiveness or is this desktop-only?

5. **Priority & Scope**:
   - What's the timeline? Quick fixes or comprehensive redesign?
   - Most important: Visual polish, feature additions, or workflow optimization?
   - Are there specific competitors or designs you want to emulate?

## Proposed UI/UX Enhancement Plan

### Phase 6.4: Smart UI/UX Improvement Strategy

**Target User**: Small business owner/freelancer with co-mingled personal/business credit card expenses  
**Goal**: Transform 4-hour tax prep into 30-minute task  
**Design Inspiration**: Xero dark mode - professional, traditional business software  
**Timeline**: Weeks available - slow, steady, methodical approach  

### 🎯 **Methodical Enhancement Roadmap**

#### Sprint 1: Foundation & Layout Fix (2-3 days) ✅
**Goal**: Fix cramped layout, improve spacing, reduce scrolling
- [ ] **Task 1.1**: Fix remaining CSS issues (`border-border`, `tailwindcss-animate`)
- [ ] **Task 1.2**: Implement proper responsive grid layout (reduce scrolling)
- [ ] **Task 1.3**: Add consistent spacing system (8px base unit)
- [ ] **Task 1.4**: Create sticky headers/navigation for long lists

#### Sprint 2: Transaction Page Overhaul (3-4 days) 🎯
**Goal**: Transform worst page into best feature
- [ ] **Task 2.1**: Add toggle switches for each transaction (business/personal)
- [ ] **Task 2.2**: Implement "Include All" master toggle at top
- [ ] **Task 2.3**: Add amount-based sorting (expensive first)
- [ ] **Task 2.4**: Create recurring transaction detection & bulk selection
- [ ] **Task 2.5**: Visual indicators for categorization confidence

#### Sprint 3: Smart Categorization System (3-4 days) 🔧
**Goal**: LLM-powered categorization with easy manual override
- [ ] **Task 3.1**: Display LLM confidence scores for categories
- [ ] **Task 3.2**: Quick category override dropdown on each transaction
- [ ] **Task 3.3**: Implement IRS-compliant category mapping
- [ ] **Task 3.4**: Add category learning from user corrections

#### Sprint 4: Upload Experience Enhancement (2-3 days) 📤
**Goal**: Clear guidance for CSV naming and upload
- [ ] **Task 4.1**: Add upload instructions (name files by card)
- [ ] **Task 4.2**: Multi-file drag & drop with progress indicators
- [ ] **Task 4.3**: File validation with clear error messages
- [ ] **Task 4.4**: Show uploaded files list with edit/delete options

#### Sprint 5: Export & Desktop Packaging (3-4 days) 💾
**Goal**: Professional export options & desktop app
- [ ] **Task 5.1**: Implement filtered CSV export (business only)
- [ ] **Task 5.2**: Create professional PDF export with summaries
- [ ] **Task 5.3**: Package as Electron desktop app
- [ ] **Task 5.4**: Create installers for Mac & Windows

### 📊 **Detailed User Journey Implementation**

**1. Upload Phase** 📁
- Clear instructions: "Name your CSV files by credit card (e.g., 'Chase_Business.csv')"
- Drag & drop zone with visual feedback
- Progress bars for processing
- Success confirmation with transaction count

**2. Transaction Review** 🔍
- **Master Toggle**: "Include All Business Expenses" button
- **Individual Toggles**: Business/Personal switch on each row
- **Smart Sorting**: By amount (high → low), date, vendor
- **Recurring Detection**: "Select all OpenAI subscriptions" type actions
- **Visual Hierarchy**: Clear separation between included/excluded

**3. Categorization** 📊
- **LLM Pre-fill**: Show confidence level (e.g., "95% confident: Software")
- **Quick Override**: Dropdown on hover/click
- **IRS Categories**: Travel, Meals (50%), Office, Software, etc.
- **Bulk Actions**: "Categorize all Uber as Travel"

**4. Export** 📄
- **Business Only**: Only export toggled transactions
- **Format Options**: CSV for accountant, PDF for records
- **Summary Page**: Total deductions by category
- **Audit Trail**: Include categorization confidence

### 🎨 **Xero-Inspired Design System**

**Colors** (Dark Mode):
- Background: `#1a1a1a` (near black)
- Surface: `#2d2d2d` (dark gray cards)
- Primary: `#0078d4` (professional blue)
- Success: `#107c10` (included/business)
- Muted: `#6b6b6b` (excluded/personal)

**Typography**:
- Headers: Inter/System UI (clean, professional)
- Body: 14px base, 1.5 line height
- Monospace: Numbers/amounts

**Components**:
- Subtle shadows for depth
- 4px border radius (not too rounded)
- Clear hover states
- Professional toggle switches

### 🚀 **Implementation Priority**

**Week 1**: Foundation + Transaction Page
- Fix layout issues
- Implement toggle system
- Add sorting/filtering

**Week 2**: Smart Features
- Recurring transaction detection
- Bulk selection tools
- Category improvements

**Week 3**: Polish + Desktop
- Upload experience
- Export functionality
- Electron packaging

**Success Metrics**:
- 30-minute completion time (down from 4 hours)
- Zero scrolling on main views
- One-click bulk actions
- Clear visual hierarchy

## Executor's Feedback or Assistance Requests

**Ready to Begin Sprint 1**: The plan is set for a methodical transformation into a professional Xero-style business expense tool. Starting with foundation fixes, then systematically improving each phase of the user journey.

**First Actions**:
1. Fix CSS compilation issues
2. Implement proper spacing system
3. Begin transaction page toggle implementation

**No Blockers**: Clear vision, achievable sprints, risk-tolerant approach with Git safety net.

## Lessons

- Include info useful for debugging in the program output.
- Read the file before you try to edit it.
- If there are vulnerabilities that appear in the terminal, run npm audit before proceeding
- Always ask before using the -force git command
- V0 generates functional code but requires UX refinement for professional applications
- CSS compilation issues persist across different frontend implementations - need systematic approach to Tailwind config
- API integration works well, but UI layer needs user-focused design iteration
- Technical success doesn't guarantee user satisfaction - UX planning is critical
- Xero-style UI: Dark mode with subtle depth, professional typography, clear visual hierarchy
- Small business workflow: Upload → Toggle (business/personal) → Categorize → Export
- Key insight: Co-mingled funds require individual transaction toggles, not just categorization
- Recurring transactions: Critical time-saver for subscriptions and regular expenses
- Desktop packaging: Electron for cross-platform .exe/.app distribution

---

**Planner Notes**: This plan follows the detailed implementation phases from Instructions.md while accounting for the existing Next.js frontend. The approach is incremental with clear success criteria for each task. The Executor should complete one task at a time and report back before proceeding. 