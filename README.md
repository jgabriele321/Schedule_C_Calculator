# Schedule C Desktop Tax Assistant

A powerful desktop application for small business owners, freelancers, and single-member LLCs to automatically process financial data and generate IRS-compliant **Schedule C (Form 1040)** tax documents.

## 🌟 Features

- **Multi-Bank CSV Processing**: Supports Chase, Amex, and other major bank CSV formats
- **Smart Transaction Classification**: AI-powered categorization using OpenRouter LLM integration
- **Payment Exclusion**: Automatically filters out payments to focus on business transactions
- **Vendor Recognition**: Identifies recurring vendors and suggests classification rules
- **Schedule C Mapping**: Direct mapping to IRS Schedule C line items (1-31)
- **Deduction Tracking**: Vehicle mileage and home office deduction calculations
- **Export Options**: Generate PDF Schedule C forms and detailed CSV reports

## 🏗️ Architecture

```
Next.js Frontend (React/TypeScript)
└── REST API Communication
    └── Go Backend Server (localhost:8080)
        ├── SQLite Database (Persistent Storage)
        ├── CSV Parser & Normalizer
        ├── OpenRouter LLM Integration
        ├── Transaction Classifier
        ├── Schedule C Calculator
        └── PDF/CSV Export Engine
```

## 🚀 Getting Started

### Prerequisites

- **Go 1.19+** for backend development
- **Node.js 18+** for frontend development
- **OpenRouter API Key** for LLM categorization

### Environment Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/jgabriele321/Schedule_C_Calculator.git
   cd Schedule_C_Calculator
   ```

2. **Set up environment variables**:
   Create a `.env` file in the project root:
   ```bash
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   ```

3. **Start the Go backend**:
   ```bash
   cd backend
   go mod download
   go run main.go
   ```
   Server will start at `http://localhost:8080`

4. **Start the Next.js frontend**:
   ```bash
   cd my-app
   npm install
   npm run dev
   ```
   Frontend will be available at `http://localhost:3000`

## 📊 API Endpoints

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload-csv` | Upload and process bank CSV files |
| `GET` | `/transactions` | Retrieve transactions with filtering |
| `POST` | `/classify` | Update transaction classifications |
| `GET` | `/health` | Health check and database status |

### Query Parameters

- **Filtering**: `?highValue=true&threshold=100&type=expense&card=Chase`
- **Recurring**: `?recurring=true` - Find vendors that appear multiple times
- **Type**: `?type=income|expense|uncategorized`

## 🗃️ Database Schema

### Transactions Table
```sql
CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    date DATETIME,
    vendor TEXT,
    amount REAL,
    card TEXT,
    category TEXT,
    purpose TEXT,
    expensable BOOLEAN,
    type TEXT,
    source_file TEXT
);
```

### Supported CSV Formats

- **Chase**: `Status,Date,Description,Debit,Credit`
- **Amex**: `Date,Description,Amount,Extended Details,...`
- **Generic**: Auto-detection for other bank formats

## 🧠 LLM Integration

The system uses OpenRouter API to intelligently categorize transactions:

- **Vendor Recognition**: Clean and normalize vendor names
- **Category Assignment**: Map to IRS Schedule C categories
- **Business vs Personal**: Determine expensability
- **Recurring Patterns**: Learn from user corrections

## 📈 Current Status

### ✅ Phase 1: Backend Foundation (COMPLETED)
- [x] Go REST API server with SQLite database
- [x] CSV upload and parsing (Chase, Amex formats)
- [x] Transaction storage and retrieval
- [x] Payment filtering (excludes 30+ payment transactions)
- [x] Basic filtering API

### 🔄 Phase 2: Classification System (IN PROGRESS)
- [ ] LLM-powered vendor recognition
- [ ] Manual classification endpoints
- [ ] Vendor rule engine
- [ ] High-value transaction detection

### 📋 Phase 3: Deduction Management (PLANNED)
- [ ] Vehicle mileage tracking ($0.67/mile for 2024)
- [ ] Home office deductions (simplified vs actual method)
- [ ] Deduction persistence and retrieval

### 🧮 Phase 4: Schedule C Calculation (PLANNED)
- [ ] Line-by-line Schedule C calculations
- [ ] Category mapping to IRS line items
- [ ] Profit/loss calculations

### 📄 Phase 5: Export System (PLANNED)
- [ ] PDF Schedule C form generation
- [ ] Detailed CSV export for accountants
- [ ] Validation and error handling

## 🧪 Testing with Sample Data

The project includes real sample data for testing:

- **Chase Card.CSV**: 698 transactions, 26 payments excluded
- **Amex Gold.csv**: 80 transactions, 4 payments excluded  
- **Amex Purple.csv**: 43 transactions, 1 payment excluded

**Total**: 821 transactions processed, 30 payments excluded

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 Links

- **Repository**: [https://github.com/jgabriele321/Schedule_C_Calculator](https://github.com/jgabriele321/Schedule_C_Calculator)
- **Issues**: [Report bugs or request features](https://github.com/jgabriele321/Schedule_C_Calculator/issues)
- **OpenRouter**: [Get your API key](https://openrouter.ai/)

## 📞 Support

For questions or support, please [open an issue](https://github.com/jgabriele321/Schedule_C_Calculator/issues) on GitHub.

---

**Built with ❤️ for small business owners and freelancers** 