const supabase = require('../../lib/supabase');
const { authenticateToken, requireAdmin } = require('../_middleware');
const XLSX = require('xlsx');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const authResult = await authenticateToken(req);
        if (authResult.error) {
            return res.status(authResult.error.status).json({ message: authResult.error.message });
        }

        const { user } = authResult;
        const adminError = requireAdmin(user);
        if (adminError) {
            return res.status(adminError.error.status).json({ message: adminError.error.message });
        }

        const { format = 'json' } = req.query;

        // Fetch data with explicit relation mappings to ensure data is returned
        const [salesResponse, itemsResponse, additionsResponse] = await Promise.all([
            supabase
                .from('sales')
                .select(`
          sale_id, 
          total_amount, 
          quantity_sold, 
          date_time, 
          sale_type,
          item_id, 
          items:item_id(item_name)
        `),
            supabase
                .from('items')
                .select(`
          item_id, 
          item_name,
          category,
          initial_stock, 
          buying_price, 
          unit_price,
          current_stock
        `),
            supabase
                .from('stock_additions')
                .select('item_id, quantity_added, date_added')
        ]);

        if (salesResponse.error) throw salesResponse.error;
        if (itemsResponse.error) throw itemsResponse.error;
        if (additionsResponse.error) throw additionsResponse.error;

        const sales = salesResponse.data || [];
        const items = itemsResponse.data || [];
        const additions = additionsResponse.data || [];

        // Map additions to items for easy lookup
        const additionsMap = {};
        additions.forEach(a => {
            if (!additionsMap[a.item_id]) additionsMap[a.item_id] = 0;
            additionsMap[a.item_id] += Number(a.quantity_added) || 0;
        });

        // Summary calculations
        const totalRevenue = sales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);
        const totalSalesCount = sales.length;
        const totalUnitsSold = sales.reduce((sum, s) => sum + (Number(s.quantity_sold) || 0), 0);

        const totalInvestment = items.reduce((sum, item) => {
            const initialStock = Number(item.initial_stock) || 0;
            const price = Number(item.buying_price || item.unit_price) || 0;
            const totalAdded = additionsMap[item.item_id] || 0;
            return sum + ((initialStock + totalAdded) * price);
        }, 0);

        const grossProfit = totalRevenue - totalInvestment;

        // Monthly trends
        const trendsMap = {};
        sales.forEach(sale => {
            if (!sale.date_time) return;
            const month = sale.date_time.substring(0, 7);
            if (!trendsMap[month]) {
                trendsMap[month] = { month, revenue: 0, sales_count: 0 };
            }
            trendsMap[month].revenue += Number(sale.total_amount) || 0;
            trendsMap[month].sales_count += 1;
        });
        const monthlyTrends = Object.values(trendsMap)
            .sort((a, b) => b.month.localeCompare(a.month))
            .slice(0, 12);

        // Top selling items
        const topSellersMap = {};
        sales.forEach(sale => {
            const itemName = sale.items?.item_name || 'Unknown Item';
            if (!topSellersMap[itemName]) {
                topSellersMap[itemName] = { item_name: itemName, total_sold: 0, total_revenue: 0 };
            }
            topSellersMap[itemName].total_sold += Number(sale.quantity_sold) || 0;
            topSellersMap[itemName].total_revenue += Number(sale.total_amount) || 0;
        });
        const topSellers = Object.values(topSellersMap)
            .sort((a, b) => b.total_sold - a.total_sold)
            .slice(0, 10);

        if (format === 'excel') {
            const wb = XLSX.utils.book_new();

            // Detailed Sales Sheet
            const salesDetailed = sales.map(s => ({
                'Date': new Date(s.date_time).toLocaleString(),
                'Item': s.items?.item_name || 'Unknown',
                'Qty': s.quantity_sold,
                'Amount': s.total_amount,
                'Type': s.sale_type
            }));

            // Stock Status Sheet
            const stockDetailed = items.map(i => ({
                'Item': i.item_name,
                'Category': i.category,
                'Initial': i.initial_stock,
                'Added': additionsMap[i.item_id] || 0,
                'Available': i.current_stock,
                'Price': i.unit_price
            }));

            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{
                'Total Revenue': totalRevenue,
                'Total Investment': totalInvestment,
                'Gross Profit': grossProfit,
                'Units Sold': totalUnitsSold
            }]), 'Summary');

            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesDetailed), 'Transactions');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stockDetailed), 'Stock Inventory');

            const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=business_performance.xlsx');
            return res.send(buffer);

        } else if (format === 'pdf') {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();

            // Report Header
            doc.setFontSize(22);
            doc.text('Performance & Data Report', pageWidth / 2, 20, { align: 'center' });
            doc.setFontSize(10);
            doc.text(`Project: Thrift Shop Inventory | Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 28, { align: 'center' });

            // 1. Executive Summary
            doc.setFontSize(16);
            doc.text('1. Business Summary', 14, 45);
            doc.autoTable({
                startY: 50,
                head: [['Metric', 'Value']],
                body: [
                    ['Total Revenue', `Ksh ${totalRevenue.toLocaleString()}`],
                    ['Total Investment (Total Stock Cost)', `Ksh ${totalInvestment.toLocaleString()}`],
                    ['Gross Profit', `Ksh ${grossProfit.toLocaleString()}`],
                    ['Overall Sales Count', totalSalesCount],
                    ['Total Units Movied', totalUnitsSold]
                ],
                theme: 'striped',
                headStyles: { fillColor: [41, 128, 185] }
            });

            // 2. Recent Sales Data (Request by user: "data already added and sales")
            let nextY = doc.lastAutoTable.finalY + 15;
            doc.text('2. Recent Sales Transactions', 14, nextY);
            doc.autoTable({
                startY: nextY + 5,
                head: [['Date', 'Item', 'Qty', 'Total', 'Type']],
                body: sales.slice(0, 15).map(s => [
                    new Date(s.date_time).toLocaleDateString(),
                    s.items?.item_name || 'N/A',
                    s.quantity_sold,
                    `Ksh ${s.total_amount.toLocaleString()}`,
                    s.sale_type.toUpperCase()
                ]),
                theme: 'grid'
            });

            // 3. Stock Level Summary
            if (doc.lastAutoTable.finalY > 200) doc.addPage();
            nextY = (doc.lastAutoTable.finalY > 200) ? 25 : doc.lastAutoTable.finalY + 15;
            doc.text('3. Current Stock Status', 14, nextY);
            doc.autoTable({
                startY: nextY + 5,
                head: [['Item Name', 'Initial', 'Added', 'Available Stock']],
                body: items.slice(0, 15).map(i => [
                    i.item_name,
                    i.initial_stock,
                    additionsMap[i.item_id] || 0,
                    i.current_stock
                ]),
                theme: 'striped',
                headStyles: { fillColor: [39, 174, 96] }
            });

            const pdfBuffer = doc.output('arraybuffer');
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=performance_report.pdf');
            return res.send(Buffer.from(pdfBuffer));

        } else {
            return res.json({ summary: { totalRevenue, totalInvestment, grossProfit }, sales: sales.length, items: items.length });
        }

    } catch (error) {
        console.error('[Performance Report Error]:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
