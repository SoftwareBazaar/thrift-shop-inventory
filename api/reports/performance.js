const supabase = require('../../lib/supabase');
const { authenticateToken, requireAdmin } = require('../_middleware');
const XLSX = require('xlsx');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');

module.exports = async (req, res) => {
    // Support both GET (Supabase lookup) and POST (Direct data from client)
    if (req.method !== 'GET' && req.method !== 'POST') {
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

        let sales = [];
        let items = [];
        let additions = [];
        let additionsMap = {};

        // Use provided data if POSTed, otherwise fetch from Supabase
        if (req.method === 'POST' && req.body && req.body.sales) {
            console.log('📝 Generating report using client-provided data');
            sales = req.body.sales || [];
            items = req.body.items || [];
            // If client provides items, they might already have calculated additions or we use them as is
            additions = req.body.additions || [];
        } else {
            console.log('🔍 Generating report using Supabase data');
            const [salesResponse, itemsResponse, additionsResponse] = await Promise.all([
                supabase.from('sales').select('*, items:item_id(item_name)'),
                supabase.from('items').select('*'),
                supabase.from('stock_additions').select('*')
            ]);

            if (salesResponse.error) throw salesResponse.error;
            if (itemsResponse.error) throw itemsResponse.error;
            if (additionsResponse.error) throw additionsResponse.error;

            sales = salesResponse.data || [];
            items = itemsResponse.data || [];
            additions = additionsResponse.data || [];
        }

        // Process additions
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
            const totalAdded = additionsMap[item.item_id] || Number(item.total_added) || 0;
            return sum + ((initialStock + totalAdded) * price);
        }, 0);

        const grossProfit = totalRevenue - totalInvestment;

        if (format === 'excel') {
            const wb = XLSX.utils.book_new();
            const summaryData = [{ 'Total Revenue': totalRevenue, 'Total Investment': totalInvestment, 'Gross Profit': grossProfit, 'Units Sold': totalUnitsSold }];
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'Summary');
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sales.map(s => ({
                'Date': new Date(s.date_time).toLocaleString(),
                'Item': s.items?.item_name || s.item_name || 'N/A',
                'Qty': s.quantity_sold,
                'Amount': s.total_amount,
                'Type': s.sale_type
            }))), 'Transactions');

            const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=performance_report.xlsx');
            return res.send(buffer);

        } else if (format === 'pdf') {
            const doc = new jsPDF();
            doc.setFontSize(22);
            doc.text('Performance Report', 105, 20, { align: 'center' });

            doc.autoTable({
                startY: 35,
                head: [['Metric', 'Value']],
                body: [
                    ['Total Revenue', `Ksh ${totalRevenue.toLocaleString()}`],
                    ['Total Investment', `Ksh ${totalInvestment.toLocaleString()}`],
                    ['Gross Profit', `Ksh ${grossProfit.toLocaleString()}`],
                    ['Units Moved', totalUnitsSold]
                ]
            });

            doc.text('Recent Sales', 14, doc.lastAutoTable.finalY + 15);
            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 20,
                head: [['Date', 'Item', 'Qty', 'Total']],
                body: sales.slice(0, 20).map(s => [
                    new Date(s.date_time).toLocaleDateString(),
                    s.items?.item_name || s.item_name || 'N/A',
                    s.quantity_sold,
                    `Ksh ${s.total_amount.toLocaleString()}`
                ])
            });

            const pdfBuffer = doc.output('arraybuffer');
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=performance_report.pdf');
            return res.send(Buffer.from(pdfBuffer));
        } else {
            return res.json({ totalRevenue, totalInvestment, grossProfit });
        }
    } catch (error) {
        console.error('[Performance Report Error]:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
