const supabase = require('../../lib/supabase');
const { authenticateToken, requireAdmin } = require('../_middleware');
const XLSX = require('xlsx');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');

module.exports = async (req, res) => {
    // 1. Handle CORS Preflight / OPTIONS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 2. Validate Method
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        // 3. Authenticate
        const authResult = await authenticateToken(req);
        if (authResult.error) {
            return res.status(authResult.error.status).json({ message: authResult.error.message });
        }

        const { format = 'json' } = req.query;
        let items = [];

        // 4. Extract Data
        if (req.method === 'POST' && req.body && req.body.items) {
            console.log('[Inventory Report] Using client-provided data');
            items = req.body.items;
        } else {
            console.log('[Inventory Report] Fetching from Supabase');
            const { data, error } = await supabase.from('items').select('*');
            if (error) throw error;
            items = data || [];
        }

        // 5. Generate Response
        if (format === 'excel') {
            const ws = XLSX.utils.json_to_sheet(items);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
            const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=inventory_report.xlsx');
            return res.send(buffer);
        } else if (format === 'pdf') {
            const doc = new jsPDF('l');
            doc.setFontSize(22);
            doc.text('Inventory Status Report', 148, 20, { align: 'center' });
            doc.autoTable({
                startY: 30,
                head: [['Item Name', 'Category', 'Initial stock', 'Admin Stock', 'Price']],
                body: items.map(i => [i.item_name, i.category, i.initial_stock, i.current_stock, i.unit_price]),
                theme: 'striped',
                headStyles: { fillColor: [52, 73, 94] }
            });
            const pdfBuffer = doc.output('arraybuffer');
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=inventory_report.pdf');
            return res.send(Buffer.from(pdfBuffer));
        } else {
            return res.json({ items });
        }
    } catch (error) {
        console.error('[Inventory Report Error]:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
