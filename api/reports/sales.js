const supabase = require('../../lib/supabase');
const { authenticateToken, requireAdmin } = require('../_middleware');
const XLSX = require('xlsx');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');

module.exports = async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const authResult = await authenticateToken(req);
        if (authResult.error) {
            return res.status(authResult.error.status).json({ message: authResult.error.message });
        }

        const { format = 'json' } = req.query;
        let sales = [];

        if (req.method === 'POST' && req.body && req.body.sales) {
            sales = req.body.sales;
        } else {
            const { data, error } = await supabase.from('sales').select('*, items:item_id(item_name), stalls:stall_id(stall_name), users:recorded_by(full_name)');
            if (error) throw error;
            sales = data || [];
        }

        if (format === 'excel') {
            const ws = XLSX.utils.json_to_sheet(sales.map(s => ({
                'Date': new Date(s.date_time).toLocaleString(),
                'Item': s.item_name || s.items?.item_name || 'N/A',
                'Stall': s.stall_name || s.stalls?.stall_name || 'Admin',
                'User': s.recorded_by_name || s.users?.full_name || 'N/A',
                'Qty': s.quantity_sold,
                'Amount': s.total_amount,
                'Type': s.sale_type
            })));
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Sales History');
            const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=sales_report.xlsx');
            return res.send(buffer);
        } else if (format === 'pdf') {
            const doc = new jsPDF('l');
            doc.text('Sales Transaction Report', 148, 20, { align: 'center' });
            doc.autoTable({
                startY: 30,
                head: [['Date', 'Item', 'Stall', 'Sold By', 'Qty', 'Total']],
                body: sales.map(s => [
                    new Date(s.date_time).toLocaleDateString(),
                    s.item_name || s.items?.item_name || 'N/A',
                    s.stall_name || s.stalls?.stall_name || 'Admin',
                    s.recorded_by_name || s.users?.full_name || 'N/A',
                    s.quantity_sold,
                    `Ksh ${s.total_amount.toLocaleString()}`
                ])
            });
            const pdfBuffer = doc.output('arraybuffer');
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=sales_report.pdf');
            return res.send(Buffer.from(pdfBuffer));
        } else {
            return res.json({ sales });
        }
    } catch (error) {
        console.error('[Sales Report Error]:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
