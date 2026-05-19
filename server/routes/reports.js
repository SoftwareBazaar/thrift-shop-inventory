const express = require('express');
const pool = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const XLSX = require('xlsx');
const jsPDF = require('jspdf');
const autoTable = require('jspdf-autotable');

const router = express.Router();

// Get inventory report
router.get('/inventory', authenticateToken, async (req, res) => {
  try {
    const { format = 'json', category, low_stock } = req.query;

    let whereClause = 'WHERE 1=1';
    const queryParams = [];
    let paramIndex = 1;

    // Filter by category
    if (category) {
      whereClause += ` AND i.category = $${paramIndex}`;
      queryParams.push(category);
      paramIndex++;
    }

    // Filter low stock items
    if (low_stock === 'true') {
      whereClause += ` AND i.current_stock <= 5`;
    }

    // If user is not admin, only show items from their stall
    if (req.user.role === 'user' && req.user.stall_id) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM stock_distribution sd 
        WHERE sd.item_id = i.item_id AND sd.stall_id = $${paramIndex}
      )`;
      queryParams.push(req.user.stall_id);
      paramIndex++;
    }

    const inventoryQuery = `
      SELECT 
        i.item_id,
        i.item_name,
        i.category,
        i.initial_stock,
        i.current_stock,
        i.unit_price,
        (i.current_stock * i.unit_price) as total_value,
        i.date_added,
        i.sku,
        COALESCE(SUM(sd.quantity_allocated), 0) as total_allocated,
        COALESCE(SUM(sa.quantity_added), 0) as total_added
      FROM items i
      LEFT JOIN stock_distribution sd ON i.item_id = sd.item_id
      LEFT JOIN stock_additions sa ON i.item_id = sa.item_id
      ${whereClause}
      GROUP BY i.item_id, i.item_name, i.category, i.initial_stock, i.current_stock, 
               i.unit_price, i.date_added, i.sku
      ORDER BY i.item_name
    `;

    const inventoryResult = await pool.query(inventoryQuery, queryParams);

    if (format === 'excel') {
      // Generate Excel file
      const ws = XLSX.utils.json_to_sheet(inventoryResult.rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventory Report');

      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=inventory_report.xlsx');
      res.send(excelBuffer);
    } else if (format === 'pdf') {
      // Generate PDF
      const doc = new jsPDF();
      doc.text('Inventory Report', 20, 20);

      const tableData = inventoryResult.rows.map(item => [
        item.item_name,
        item.category,
        item.current_stock,
        `$${item.unit_price}`,
        `$${item.total_value}`
      ]);

      autoTable(doc, {
        head: [['Item Name', 'Category', 'Stock', 'Unit Price', 'Total Value']],
        body: tableData,
        startY: 30
      });

      const pdfBuffer = doc.output('arraybuffer');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=inventory_report.pdf');
      res.send(Buffer.from(pdfBuffer));
    } else {
      // Return JSON
      res.json({ inventory: inventoryResult.rows });
    }
  } catch (error) {
    console.error('Inventory report error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get sales report
router.get('/sales', authenticateToken, async (req, res) => {
  try {
    const {
      format = 'json',
      start_date,
      end_date,
      stall_id,
      sale_type
    } = req.query;

    let whereClause = 'WHERE 1=1';
    const queryParams = [];
    let paramIndex = 1;

    // Filter by date range
    if (start_date) {
      whereClause += ` AND s.date_time >= $${paramIndex}`;
      queryParams.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      whereClause += ` AND s.date_time <= $${paramIndex}`;
      queryParams.push(end_date);
      paramIndex++;
    }

    // Filter by sale type
    if (sale_type) {
      whereClause += ` AND s.sale_type = $${paramIndex}`;
      queryParams.push(sale_type);
      paramIndex++;
    }

    // If user is not admin, only show their stall's sales
    if (req.user.role === 'user' && req.user.stall_id) {
      whereClause += ` AND s.stall_id = $${paramIndex}`;
      queryParams.push(req.user.stall_id);
      paramIndex++;
    } else if (req.user.role === 'admin' && stall_id) {
      whereClause += ` AND s.stall_id = $${paramIndex}`;
      queryParams.push(stall_id);
      paramIndex++;
    }

    const salesQuery = `
      SELECT 
        s.sale_id,
        s.date_time,
        i.item_name,
        i.category,
        s.quantity_sold,
        s.unit_price,
        s.total_amount,
        s.sale_type,
        st.stall_name,
        u.full_name as recorded_by_name,
        cs.customer_name,
        cs.payment_status
      FROM sales s
      JOIN items i ON s.item_id = i.item_id
      JOIN stalls st ON s.stall_id = st.stall_id
      JOIN users u ON s.recorded_by = u.user_id
      LEFT JOIN credit_sales cs ON s.sale_id = cs.sale_id
      ${whereClause}
      ORDER BY s.date_time DESC
    `;

    const salesResult = await pool.query(salesQuery, queryParams);

    if (format === 'excel') {
      // Generate Excel file
      const ws = XLSX.utils.json_to_sheet(salesResult.rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sales Report');

      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=sales_report.xlsx');
      res.send(excelBuffer);
    } else if (format === 'pdf') {
      // Generate PDF
      const doc = new jsPDF();
      doc.text('Sales Report', 20, 20);

      const tableData = salesResult.rows.map(sale => [
        sale.date_time,
        sale.item_name,
        sale.quantity_sold,
        `$${sale.unit_price}`,
        `$${sale.total_amount}`,
        sale.sale_type,
        sale.stall_name
      ]);

      autoTable(doc, {
        head: [['Date', 'Item', 'Qty', 'Unit Price', 'Total', 'Type', 'Stall']],
        body: tableData,
        startY: 30
      });

      const pdfBuffer = doc.output('arraybuffer');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=sales_report.pdf');
      res.send(Buffer.from(pdfBuffer));
    } else {
      // Return JSON
      res.json({ sales: salesResult.rows });
    }
  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get stall performance report (Admin only)
router.get('/stall-performance', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { format = 'json', start_date, end_date } = req.query;

    let dateFilter = '';
    const queryParams = [];
    let paramIndex = 1;

    // Filter by date range
    if (start_date) {
      dateFilter += ` AND s.date_time >= $${paramIndex}`;
      queryParams.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      dateFilter += ` AND s.date_time <= $${paramIndex}`;
      queryParams.push(end_date);
      paramIndex++;
    }

    const performanceQuery = `
      SELECT 
        st.stall_id,
        st.stall_name,
        u.full_name as stall_operator,
        COUNT(s.sale_id) as total_sales,
        SUM(s.total_amount) as total_revenue,
        SUM(s.quantity_sold) as total_units_sold,
        AVG(s.total_amount) as average_sale_value,
        COUNT(CASE WHEN s.sale_type = 'cash' THEN 1 END) as cash_sales,
        COUNT(CASE WHEN s.sale_type = 'credit' THEN 1 END) as credit_sales,
        SUM(CASE WHEN s.sale_type = 'cash' THEN s.total_amount ELSE 0 END) as cash_revenue,
        SUM(CASE WHEN s.sale_type = 'credit' THEN s.total_amount ELSE 0 END) as credit_revenue
      FROM stalls st
      LEFT JOIN users u ON st.user_id = u.user_id
      LEFT JOIN sales s ON st.stall_id = s.stall_id ${dateFilter}
      GROUP BY st.stall_id, st.stall_name, u.full_name
      ORDER BY total_revenue DESC
    `;

    const performanceResult = await pool.query(performanceQuery, queryParams);

    if (format === 'excel') {
      // Generate Excel file
      const ws = XLSX.utils.json_to_sheet(performanceResult.rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Stall Performance');

      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=stall_performance_report.xlsx');
      res.send(excelBuffer);
    } else {
      // Return JSON
      res.json({ performance: performanceResult.rows });
    }
  } catch (error) {
    console.error('Stall performance report error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get top sellers report
router.get('/top-sellers', authenticateToken, async (req, res) => {
  try {
    const {
      format = 'json',
      start_date,
      end_date,
      limit = 10,
      sort_by = 'quantity'
    } = req.query;

    let dateFilter = '';
    const queryParams = [];
    let paramIndex = 1;

    // Filter by date range
    if (start_date) {
      dateFilter += ` AND s.date_time >= $${paramIndex}`;
      queryParams.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      dateFilter += ` AND s.date_time <= $${paramIndex}`;
      queryParams.push(end_date);
      paramIndex++;
    }

    // If user is not admin, only show items from their stall
    if (req.user.role === 'user' && req.user.stall_id) {
      dateFilter += ` AND s.stall_id = $${paramIndex}`;
      queryParams.push(req.user.stall_id);
      paramIndex++;
    }

    const orderBy = sort_by === 'revenue' ? 'total_revenue DESC' : 'total_quantity DESC';

    const topSellersQuery = `
      SELECT 
        i.item_id,
        i.item_name,
        i.category,
        SUM(s.quantity_sold) as total_quantity,
        SUM(s.total_amount) as total_revenue,
        COUNT(s.sale_id) as sale_count,
        AVG(s.unit_price) as average_price
      FROM items i
      JOIN sales s ON i.item_id = s.item_id ${dateFilter}
      GROUP BY i.item_id, i.item_name, i.category
      ORDER BY ${orderBy}
      LIMIT $${paramIndex}
    `;

    queryParams.push(parseInt(limit));
    const topSellersResult = await pool.query(topSellersQuery, queryParams);

    if (format === 'excel') {
      // Generate Excel file
      const ws = XLSX.utils.json_to_sheet(topSellersResult.rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Top Sellers');

      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=top_sellers_report.xlsx');
      res.send(excelBuffer);
    } else {
      // Return JSON
      res.json({ top_sellers: topSellersResult.rows });
    }
  } catch (error) {
    console.error('Top sellers report error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get credit sales report (Admin only)
router.get('/credit-sales', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { format = 'json', payment_status, stall_id } = req.query;

    let whereClause = 'WHERE 1=1';
    const queryParams = [];
    let paramIndex = 1;

    // Filter by payment status
    if (payment_status) {
      whereClause += ` AND cs.payment_status = $${paramIndex}`;
      queryParams.push(payment_status);
      paramIndex++;
    }

    // Filter by stall
    if (stall_id) {
      whereClause += ` AND s.stall_id = $${paramIndex}`;
      queryParams.push(stall_id);
      paramIndex++;
    }

    const creditSalesQuery = `
      SELECT 
        cs.credit_id,
        cs.customer_name,
        cs.customer_contact,
        cs.total_credit_amount,
        cs.amount_paid,
        cs.balance_due,
        cs.payment_status,
        cs.due_date,
        cs.created_date,
        s.date_time as sale_date,
        i.item_name,
        s.quantity_sold,
        s.unit_price,
        st.stall_name,
        u.full_name as recorded_by_name
      FROM credit_sales cs
      JOIN sales s ON cs.sale_id = s.sale_id
      JOIN items i ON s.item_id = i.item_id
      JOIN stalls st ON s.stall_id = st.stall_id
      JOIN users u ON s.recorded_by = u.user_id
      ${whereClause}
      ORDER BY cs.created_date DESC
    `;

    const creditSalesResult = await pool.query(creditSalesQuery, queryParams);

    if (format === 'excel') {
      // Generate Excel file
      const ws = XLSX.utils.json_to_sheet(creditSalesResult.rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Credit Sales');

      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=credit_sales_report.xlsx');
      res.send(excelBuffer);
    } else {
      // Return JSON
      res.json({ credit_sales: creditSalesResult.rows });
    }
  } catch (error) {
    console.error('Credit sales report error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get comprehensive performance report
router.get('/performance', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { format = 'json', period = 'year' } = req.query;

    // 1. Executive Summary Data
    const summaryQuery = `
      SELECT 
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COUNT(sale_id) as total_sales,
        COALESCE(SUM(quantity_sold), 0) as total_units_sold
      FROM sales
    `;
    const summaryResult = await pool.query(summaryQuery);
    const summary = summaryResult.rows[0];

    // 2. Investment Data (Total stock ever added * buying_price)
    // First, check if buying_price column exists
    const itemCheck = await pool.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_NAME = 'items' AND COLUMN_NAME = 'buying_price'");
    const hasBuyingPrice = itemCheck.rows.length > 0;
    const priceCol = hasBuyingPrice ? 'buying_price' : 'unit_price';

    const investmentQuery = `
      SELECT 
        COALESCE(SUM((initial_stock + COALESCE(total_added, 0)) * ${priceCol}), 0) as total_investment
      FROM (
        SELECT 
          i.initial_stock, 
          i.${priceCol},
          (SELECT SUM(quantity_added) FROM stock_additions WHERE item_id = i.item_id) as total_added
        FROM items i
      ) as investment_calc
    `;
    const investmentResult = await pool.query(investmentQuery);
    const totalInvestment = investmentResult.rows[0].total_investment;
    const grossProfit = summary.total_revenue - totalInvestment;

    // 3. Monthly Sales Trend
    const trendQuery = `
      SELECT 
        TO_CHAR(date_time, 'YYYY-MM') as month,
        SUM(total_amount) as revenue,
        COUNT(sale_id) as sales_count
      FROM sales
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `;
    const trendResult = await pool.query(trendQuery);

    // 4. Top Selling Items
    const topSellersQuery = `
      SELECT 
        i.item_name,
        SUM(s.quantity_sold) as total_sold,
        SUM(s.total_amount) as total_revenue
      FROM sales s
      JOIN items i ON s.item_id = i.item_id
      GROUP BY i.item_id, i.item_name
      ORDER BY total_sold DESC
      LIMIT 10
    `;
    const topSellersResult = await pool.query(topSellersQuery);

    if (format === 'excel') {
      const wb = XLSX.utils.book_new();

      // Summary Sheet
      const summaryData = [
        { Metric: 'Total Revenue', Value: Number(summary.total_revenue) },
        { Metric: 'Total Investment', Value: Number(totalInvestment) },
        { Metric: 'Gross Profit', Value: Number(grossProfit) },
        { Metric: 'Total Sales', Value: Number(summary.total_sales) },
        { Metric: 'Units Sold', Value: Number(summary.total_units_sold) }
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'Executive Summary');

      // Monthly Trend Sheet
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trendResult.rows), 'Monthly Trends');

      // Top Sellers Sheet
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topSellersResult.rows), 'Top Sellers');

      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=performance_report.xlsx');
      res.send(excelBuffer);

    } else if (format === 'pdf') {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(22);
      doc.setTextColor(40, 44, 52);
      doc.text('Business Performance Report', pageWidth / 2, 20, { align: 'center' });

      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, 28, { align: 'center' });

      // 1. Executive Summary
      doc.setFontSize(16);
      doc.setTextColor(0);
      doc.text('1. Executive Summary', 14, 45);

      autoTable(doc, {
        startY: 50,
        head: [['Metric', 'Value']],
        body: [
          ['Total Revenue', `Ksh ${Number(summary.total_revenue).toLocaleString()}`],
          ['Total Investment', `Ksh ${Number(totalInvestment).toLocaleString()}`],
          ['Gross Profit', `Ksh ${Number(grossProfit).toLocaleString()}`],
          ['Profit Status', grossProfit >= 0 ? 'PROFIT' : 'LOSS'],
          ['Total Sales', summary.total_sales],
          ['Units Sold', summary.total_units_sold]
        ],
        theme: 'striped',
        headStyles: { fillColor: [63, 81, 181] }
      });

      // 2. Monthly Trend
      const currentY = doc.lastAutoTable.finalY + 15;
      doc.text('2. Monthly Revenue Trends', 14, currentY);

      autoTable(doc, {
        startY: currentY + 5,
        head: [['Month', 'Sales Count', 'Revenue']],
        body: trendResult.rows.map(row => [
          row.month,
          row.sales_count,
          `Ksh ${Number(row.revenue).toLocaleString()}`
        ]),
        theme: 'grid'
      });

      // 3. Top Sellers
      doc.addPage();
      doc.text('3. Top Selling Products', 14, 20);

      autoTable(doc, {
        startY: 25,
        head: [['Product Name', 'Total Units Sold', 'Total Revenue']],
        body: topSellersResult.rows.map(row => [
          row.item_name,
          row.total_sold,
          `Ksh ${Number(row.total_revenue).toLocaleString()}`
        ]),
        theme: 'striped',
        headStyles: { fillColor: [46, 125, 50] }
      });

      const pdfBuffer = doc.output('arraybuffer');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=performance_report.pdf');
      res.send(Buffer.from(pdfBuffer));

    } else {
      res.json({
        summary,
        totalInvestment,
        grossProfit,
        monthlyTrends: trendResult.rows,
        topSellers: topSellersResult.rows
      });
    }
  } catch (error) {
    console.error('Performance report error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

