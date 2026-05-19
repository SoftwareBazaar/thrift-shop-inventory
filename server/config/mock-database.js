const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

class MockDatabase {
  constructor() {
    this.dbPath = path.join(__dirname, '../../mock-db/database.json');
    this.data = this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(this.dbPath)) {
        return JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading mock database:', error);
    }
    return { users: [], items: [], sales: [], stalls: [] };
  }

  saveData() {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Error saving mock database:', error);
    }
  }

  async query(sql, params = []) {
    // Simple SQL parser for basic operations
    const sqlLower = sql.toLowerCase().trim();
    
    if (sqlLower.startsWith('select')) {
      return this.handleSelect(sql, params);
    } else if (sqlLower.startsWith('insert')) {
      return this.handleInsert(sql, params);
    } else if (sqlLower.startsWith('update')) {
      return this.handleUpdate(sql, params);
    } else if (sqlLower.startsWith('delete')) {
      return this.handleDelete(sql, params);
    }
    
    return { rows: [] };
  }

  handleSelect(sql, params) {
    const sqlLower = sql.toLowerCase();
    
    if (sqlLower.includes('from users')) {
      return { rows: this.data.users };
    } else if (sqlLower.includes('from items')) {
      return { rows: this.data.items };
    } else if (sqlLower.includes('from sales')) {
      return { rows: this.data.sales };
    } else if (sqlLower.includes('from stalls')) {
      return { rows: this.data.stalls };
    } else if (sqlLower.includes('count(*)')) {
      if (sqlLower.includes('from users')) {
        return { rows: [{ count: this.data.users.length }] };
      } else if (sqlLower.includes('from items')) {
        return { rows: [{ count: this.data.items.length }] };
      } else if (sqlLower.includes('from sales')) {
        return { rows: [{ count: this.data.sales.length }] };
      }
      return { rows: [{ count: 0 }] };
    } else if (sqlLower.includes('sum(') && sqlLower.includes('total_amount')) {
      const totalSales = this.data.sales.reduce((sum, sale) => sum + sale.total_amount, 0);
      return { rows: [{ sum: totalSales }] };
    } else if (sqlLower.includes('sum(') && sqlLower.includes('quantity_sold')) {
      const totalQuantity = this.data.sales.reduce((sum, sale) => sum + sale.quantity_sold, 0);
      return { rows: [{ sum: totalQuantity }] };
    } else if (sqlLower.includes('avg(') && sqlLower.includes('total_amount')) {
      const avgSales = this.data.sales.length > 0 ? 
        this.data.sales.reduce((sum, sale) => sum + sale.total_amount, 0) / this.data.sales.length : 0;
      return { rows: [{ avg: avgSales }] };
    }
    
    return { rows: [] };
  }

  handleInsert(sql, params) {
    // Simple insert logic
    const sqlLower = sql.toLowerCase();
    if (sqlLower.includes('into users')) {
      const newUser = {
        user_id: this.data.users.length + 1,
        username: params[0],
        password_hash: params[1],
        full_name: params[2],
        role: params[3],
        status: 'active',
        created_date: new Date().toISOString()
      };
      this.data.users.push(newUser);
      this.saveData();
      return { rows: [newUser] };
    }
    return { rows: [] };
  }

  handleUpdate(sql, params) {
    // Simple update logic
    return { rows: [] };
  }

  handleDelete(sql, params) {
    // Simple delete logic
    return { rows: [] };
  }

  async connect() {
    return this;
  }

  async end() {
    // Mock end
  }
}

module.exports = MockDatabase;
