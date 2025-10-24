# 🏪 Thrift Shop Inventory Management System

A comprehensive multi-stall inventory management system built with React, Node.js, and PostgreSQL.

## 🚀 Features

### 📊 **Dashboard**
- Real-time analytics and key metrics
- Stock value tracking
- Sales performance overview
- Outstanding credit monitoring

### 📦 **Inventory Management**
- Add, edit, and track items
- Stock distribution across stalls
- Restocking alerts
- SKU management
- Category organization

### 💰 **Sales Management**
- Cash and credit sales recording
- Credit sales tracking and reconciliation
- Sales history and analytics
- Payment tracking

### 👥 **User Management**
- Role-based access control (Admin/User)
- User authentication and authorization
- Stall assignment and management
- Activity logging

### 📈 **Reporting & Analytics**
- PDF and Excel report generation
- Sales trends and performance metrics
- Inventory reports
- Financial summaries

## 🛠️ Technology Stack

### **Frontend**
- React 18 with TypeScript
- Tailwind CSS for styling
- React Router for navigation
- Axios for API communication
- React Hook Form for forms
- Yup for validation

### **Backend**
- Node.js with Express.js
- PostgreSQL database
- JWT authentication
- Bcrypt for password hashing
- Helmet for security
- Rate limiting
- CORS support

### **Additional Tools**
- Multer for file uploads
- XLSX for Excel export
- jsPDF for PDF generation
- Nodemon for development

## 🚀 Quick Start

### **Prerequisites**
- Node.js (v16 or higher)
- npm or yarn
- PostgreSQL (for production)

### **Installation**

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/thrift-shop-inventory.git
   cd thrift-shop-inventory
   ```

2. **Install dependencies**
   ```bash
   # Install backend dependencies
   npm install
   
   # Install frontend dependencies
   cd client
   npm install
   cd ..
   ```

3. **Environment Setup**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Update .env with your database credentials
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=thrift_shop
   DB_USER=postgres
   DB_PASSWORD=your_password
   ```

4. **Database Setup**
   ```bash
   # Run database setup script
   node setup-database.js
   ```

5. **Start the application**
   ```bash
   # Development mode (both frontend and backend)
   npm run dev
   
   # Or start individually
   npm run server  # Backend only
   npm run client  # Frontend only
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - Default login: admin / admin123

## 📱 Usage

### **Login**
- **Admin**: Full access to all features
- **User**: Limited to assigned stall operations

### **Dashboard**
- View key metrics and analytics
- Quick access to common tasks
- Real-time data updates

### **Inventory Management**
- Add new items with details
- Track stock levels across stalls
- Manage categories and SKUs
- Set up restocking alerts

### **Sales Recording**
- Record cash sales
- Process credit sales
- Track payments and balances
- Generate receipts

### **Reports**
- Generate inventory reports
- Export sales data
- Create financial summaries
- Schedule automated reports

## 🔧 Development

### **Project Structure**
```
thrift-shop-inventory/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── contexts/      # React contexts
│   │   └── utils/         # Utility functions
├── server/                # Node.js backend
│   ├── config/           # Configuration files
│   ├── middleware/       # Express middleware
│   ├── routes/          # API routes
│   └── schema/          # Database schema
├── mock-db/              # Mock database (development)
└── docs/                # Documentation
```

### **Available Scripts**

```bash
# Development
npm run dev          # Start both frontend and backend
npm run server       # Start backend only
npm run client       # Start frontend only

# Production
npm run build        # Build frontend for production
npm start           # Start production server

# Database
npm run db:setup    # Setup database
npm run db:reset    # Reset database
```

## 🌐 Deployment

### **Vercel Deployment**

1. **Connect to Vercel**
   ```bash
   npm i -g vercel
   vercel login
   ```

2. **Deploy Frontend**
   ```bash
   cd client
   vercel
   ```

3. **Deploy Backend**
   - Use Railway, Render, or Heroku for backend
   - Update frontend API URLs

### **Environment Variables**

```env
# Database
DB_HOST=your_database_host
DB_PORT=5432
DB_NAME=thrift_shop
DB_USER=your_username
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_jwt_secret

# API
API_URL=http://localhost:5000
```

## 📊 API Documentation

### **Authentication**
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/profile` - Get user profile

### **Inventory**
- `GET /api/inventory` - Get all items
- `POST /api/inventory` - Add new item
- `PUT /api/inventory/:id` - Update item
- `DELETE /api/inventory/:id` - Delete item

### **Sales**
- `GET /api/sales` - Get sales records
- `POST /api/sales` - Record new sale
- `GET /api/sales/summary` - Get sales summary
- `GET /api/sales/credit` - Get credit sales

### **Reports**
- `GET /api/reports/inventory` - Inventory report
- `GET /api/reports/sales` - Sales report
- `GET /api/reports/financial` - Financial report

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, email support@thriftshop.com or create an issue in the repository.

## 🎯 Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard
- [ ] Barcode scanning
- [ ] Multi-language support
- [ ] Advanced reporting features
- [ ] Integration with payment gateways

---

**Built with ❤️ for thrift shop owners**