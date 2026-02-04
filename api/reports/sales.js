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
        const { format = 'json', start_date, end_date, stall_id } = req.query;

        // Build sales query with explicit relation mapping
        let query = supabase
            .from('sales')
            .select(`
        sale_id, date_time, quantity_sold, unit_price, total_amount, sale_type, 
        items:item_id(item_name),
        stalls:stall_id(stall_name),
        users:recorded_by(full_name)
      `);

        if (start_date) query = query.gte('date_time', start_date);
        if (end_date) query = query.lte('date_time', end_date);

        const targetStallId = user.role === 'admin' ? stall_id : user.stall_id;
        if (targetStallId) {
            query = query.eq('stall_id', targetStallId);
        }

        const { data: sales, error } = await query.order('date_time', { ascending: false });
        if (error) throw error;

        const processedSales = sales.map(sale => ({
            date: new Date(sale.date_time).toLocaleString(),
            item: sale.items?.item_name || 'N/A',
            stall: sale.stalls?.stall_name || 'Admin',
            recorded_by: sale.users?.full_name || 'N/A',
            quantity: sale.quantity_sold,
            unit_price: sale.unit_price,
            total: sale.total_amount,
            type: sale.sale_type.toUpperCase()
        }));

        if (format === 'excel') {
            const ws = XLSX.utils.json_to_sheet(processedSales);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Sales Report');
            const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=sales_history.xlsx');
            return res.send(buffer);
        } else if (format === 'pdf') {
            const doc = new jsPDF('l', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            doc.setFontSize(22);
            doc.text('Detailed Sales Report', pageWidth / 2, 20, { align: 'center' });
            doc.autoTable({
                startY: 35,
                head: [['Date/Time', 'Item', 'Stall', 'Sold By', 'Qty', 'Price', 'Total', 'Type']],
                body: processedSales.map(s => [s.date, s.item, s.stall, s.recorded_by, s.quantity, `Ksh ${s.unit_price.toLocaleString()}`, `Ksh ${s.total.toLocaleString()}`, s.type]),
                theme: 'striped',
                headStyles: { fillColor: [44, 62, 80] }
            });
            const pdfBuffer = doc.output('arraybuffer');
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=sales_report.pdf');
            return res.send(Buffer.from(pdfBuffer));
        } else {
            return res.json({ sales: processedSales });
        }
    } catch (error) {
        console.error('[Sales Report Error]:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
