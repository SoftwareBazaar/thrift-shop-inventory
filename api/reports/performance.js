const supabase = require('../../lib/supabase');
const { authenticateToken, requireAdmin } = require('../_middleware');
const XLSX = require('xlsx');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');

module.exports = async (req, res) => {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        // Authenticate user
        const authResult = await authenticateToken(req);
        if (authResult.error) {
            return res.status(authResult.error.status).json({ message: authResult.error.message });
        }

        const { user } = authResult;

        // Require admin for performance reports
        const adminError = requireAdmin(user);
        if (adminError) {
            return res.status(adminError.error.status).json({ message: adminError.error.message });
        }

        const { format = 'json' } = req.query;

        // 1. Fetch Summary Data (Sales)
        const { data: sales, error: salesError } = await supabase
            .from('sales')
            .select('sale_id, total_amount, quantity_sold, date_time, item_id, items(item_name)');

        if (salesError) throw salesError;

        const totalRevenue = sales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
        const totalSales = sales.length;
        const totalUnitsSold = sales.reduce((sum, s) => sum + (Number(s.quantity_sold) || 0), 0);

        // 2. Fetch Investment Data (Items)
        const { data: items, error: itemsError } = await supabase
            .from('items')
            .select('item_id, initial_stock, buying_price, unit_price, stock_additions(quantity_added)');

        if (itemsError) throw itemsError;

        const totalInvestment = items.reduce((sum, item) => {
            const initialStock = Number(item.initial_stock) || 0;
            const price = Number(item.buying_price || item.unit_price) || 0;
            const totalAdded = item.stock_additions?.reduce((s, sa) => s + (Number(sa.quantity_added) || 0), 0) || 0;
            return sum + ((initialStock + totalAdded) * price);
        }, 0);

        const grossProfit = totalRevenue - totalInvestment;

        // 3. Monthly Sales Trend
        const trends = {};
        sales.forEach(sale => {
            const month = sale.date_time.substring(0, 7); // YYYY-MM
            if (!trends[month]) {
                trends[month] = { month, revenue: 0, sales_count: 0 };
            }
            trends[month].revenue += Number(sale.total_amount) || 0;
            trends[month].sales_count += 1;
        });
        const trendResult = Object.values(trends).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 12);

        // 4. Top Selling Items
        const topSellersMap = {};
        sales.forEach(sale => {
            const itemName = sale.items?.item_name || 'Unknown Item';
            if (!topSellersMap[itemName]) {
                topSellersMap[itemName] = { item_name: itemName, total_sold: 0, total_revenue: 0 };
            }
            topSellersMap[itemName].total_sold += Number(sale.quantity_sold) || 0;
            topSellersMap[itemName].total_revenue += Number(sale.total_amount) || 0;
        });
        const topSellersResult = Object.values(topSellersMap)
            .sort((a, b) => b.total_sold - a.total_sold)
            .slice(0, 10);

        // Generate output based on format
        if (format === 'excel') {
            const wb = XLSX.utils.book_new();

            // Summary
            const summaryData = [
                { Metric: 'Total Revenue', Value: totalRevenue },
                { Metric: 'Total Investment', Value: totalInvestment },
                { Metric: 'Gross Profit', Value: grossProfit },
                { Metric: 'Total Sales', Value: totalSales },
                { Metric: 'Units Sold', Value: totalUnitsSold }
            ];
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'Executive Summary');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trendResult), 'Monthly Trends');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topSellersResult), 'Top Sellers');

            const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=performance_report.xlsx');
            return res.send(excelBuffer);

        } else if (format === 'pdf') {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();

            // Header
            doc.setFontSize(22);
            doc.text('Business Performance Report', pageWidth / 2, 20, { align: 'center' });
            doc.setFontSize(12);
            doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, 28, { align: 'center' });

            // 1. Executive Summary
            doc.setFontSize(16);
            doc.text('1. Executive Summary', 14, 45);
            doc.autoTable({
                startY: 50,
                head: [['Metric', 'Value']],
                body: [
                    ['Total Revenue', `Ksh ${totalRevenue.toLocaleString()}`],
                    ['Total Investment', `Ksh ${totalInvestment.toLocaleString()}`],
                    ['Gross Profit', `Ksh ${grossProfit.toLocaleString()}`],
                    ['Profit Status', grossProfit >= 0 ? 'PROFIT' : 'LOSS'],
                    ['Total Sales', totalSales],
                    ['Units Sold', totalUnitsSold]
                ],
                theme: 'striped',
                headStyles: { fillColor: [63, 81, 181] }
            });

            // 2. Monthly Trend
            const currentY = doc.lastAutoTable.finalY + 15;
            doc.text('2. Monthly Revenue Trends', 14, currentY);
            doc.autoTable({
                startY: currentY + 5,
                head: [['Month', 'Sales Count', 'Revenue']],
                body: trendResult.map(row => [
                    row.month,
                    row.sales_count,
                    `Ksh ${row.revenue.toLocaleString()}`
                ]),
                theme: 'grid'
            });

            // 3. Top Sellers
            doc.addPage();
            doc.text('3. Top Selling Products', 14, 20);
            doc.autoTable({
                startY: 25,
                head: [['Product Name', 'Total Units Sold', 'Total Revenue']],
                body: topSellersResult.map(row => [
                    row.item_name,
                    row.total_sold,
                    `Ksh ${row.total_revenue.toLocaleString()}`
                ]),
                theme: 'striped',
                headStyles: { fillColor: [46, 125, 50] }
            });

            const pdfBuffer = doc.output('arraybuffer');
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=performance_report.pdf');
            return res.send(Buffer.from(pdfBuffer));

        } else {
            // JSON
            return res.json({
                summary: {
                    total_revenue: totalRevenue,
                    total_sales: totalSales,
                    total_units_sold: totalUnitsSold
                },
                totalInvestment,
                grossProfit,
                monthlyTrends: trendResult,
                topSellers: topSellersResult
            });
        }
    } catch (error) {
        console.error('Performance report error:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
