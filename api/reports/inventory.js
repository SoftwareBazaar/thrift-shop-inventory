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
        const { format = 'json' } = req.query;

        // Fetch items and their related data
        const [itemsResponse, additionsResponse, distributionsResponse] = await Promise.all([
            supabase.from('items').select('*'),
            supabase.from('stock_additions').select('item_id, quantity_added'),
            supabase.from('stock_distribution').select('item_id, quantity_allocated')
        ]);

        if (itemsResponse.error) throw itemsResponse.error;

        const items = itemsResponse.data || [];
        const additions = additionsResponse.data || [];
        const distributions = distributionsResponse.data || [];

        // Aggregate data
        const additionsMap = {};
        additions.forEach(a => {
            additionsMap[a.item_id] = (additionsMap[a.item_id] || 0) + Number(a.quantity_added);
        });

        const distributionsMap = {};
        distributions.forEach(d => {
            distributionsMap[d.item_id] = (distributionsMap[d.item_id] || 0) + Number(d.quantity_allocated);
        });

        const processedItems = items.map(item => {
            const added = additionsMap[item.item_id] || 0;
            const dist = distributionsMap[item.item_id] || 0;
            const totalAdminStock = Number(item.current_stock) || 0;

            return {
                item_name: item.item_name,
                category: item.category,
                sku: item.sku || 'N/A',
                initial: item.initial_stock,
                added: added,
                total_received: Number(item.initial_stock) + added,
                distributed: dist,
                admin_stock: totalAdminStock,
                price: item.unit_price,
                value: totalAdminStock * Number(item.unit_price)
            };
        });

        if (format === 'excel') {
            const ws = XLSX.utils.json_to_sheet(processedItems);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
            const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=inventory_report.xlsx');
            return res.send(buffer);
        } else if (format === 'pdf') {
            const doc = new jsPDF('l', 'mm', 'a4');
            doc.setFontSize(22);
            doc.text('Inventory Stock Report', 148, 20, { align: 'center' });
            doc.autoTable({
                startY: 30,
                head: [['Item Name', 'Category', 'Initial', 'Added', 'Total Rec.', 'Dist.', 'Admin Stock', 'Price', 'Value']],
                body: processedItems.map(i => [
                    i.item_name, i.category, i.initial, i.added, i.total_received, i.distributed, i.admin_stock,
                    `Ksh ${i.price.toLocaleString()}`, `Ksh ${i.value.toLocaleString()}`
                ]),
                theme: 'striped',
                headStyles: { fillColor: [52, 73, 94] }
            });
            const pdfBuffer = doc.output('arraybuffer');
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=inventory_report.pdf');
            return res.send(Buffer.from(pdfBuffer));
        } else {
            return res.json({ inventory: processedItems });
        }
    } catch (error) {
        console.error('[Inventory Report Error]:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
