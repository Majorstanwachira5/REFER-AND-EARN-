const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

let dbInstance = null;
const dbPath = path.join(__dirname, '..', '..', 'ramnet.db');
const jsonDbPath = path.join(__dirname, '..', '..', 'ramnet_fallback_db.json');

let sqlite3;
try {
  sqlite3 = require('sqlite3').verbose();
} catch (e) {
  console.log('[Backend DB] native sqlite3 module not installed yet. Using fallback storage engine.');
}

// Fallback JSON-based SQLite engine with admin support
class FallbackDB {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = {
      users: [],
      transactions: [],
      referrals: [],
      counters: { users: 0, transactions: 0, referrals: 0 }
    };
    this.load();
  }

  load() {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.data = JSON.parse(raw);
      } catch (err) {
        console.error('[DB Fallback] Error reading DB file:', err);
      }
    } else {
      this.save();
    }
  }

  save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  async run(sql, params = []) {
    this.load();
    const sqlUpper = sql.toUpperCase().trim();

    if (sqlUpper.startsWith('INSERT INTO USERS')) {
      this.data.counters.users += 1;
      const id = this.data.counters.users;
      const now = new Date().toISOString();
      const newUser = {
        id,
        name: params[0],
        email: params[1],
        password: params[2],
        role: params[3] || 'agent',
        referral_code: params[4],
        referred_by: params[5] || null,
        wallet_balance: params[6] !== undefined ? params[6] : 0,
        paid_status: params[7] !== undefined ? params[7] : 0,
        created_at: now
      };
      this.data.users.push(newUser);
      this.save();
      return { lastID: id, changes: 1 };
    }

    if (sqlUpper.includes('UPDATE USERS SET PAID_STATUS = 1')) {
      const userId = params[0];
      const user = this.data.users.find(u => u.id === Number(userId));
      if (user) {
        user.paid_status = 1;
        this.save();
        return { changes: 1 };
      }
      return { changes: 0 };
    }

    if (sqlUpper.includes('UPDATE USERS SET WALLET_BALANCE = WALLET_BALANCE +')) {
      const amount = params[0];
      const userId = params[1];
      const user = this.data.users.find(u => u.id === Number(userId));
      if (user) {
        user.wallet_balance = (user.wallet_balance || 0) + Number(amount);
        this.save();
        return { changes: 1 };
      }
      return { changes: 0 };
    }

    if (sqlUpper.includes('UPDATE USERS SET WALLET_BALANCE = WALLET_BALANCE -')) {
      const amount = params[0];
      const userId = params[1];
      const user = this.data.users.find(u => u.id === Number(userId));
      if (user) {
        user.wallet_balance = (user.wallet_balance || 0) - Number(amount);
        this.save();
        return { changes: 1 };
      }
      return { changes: 0 };
    }

    if (sqlUpper.startsWith('INSERT INTO TRANSACTIONS')) {
      this.data.counters.transactions += 1;
      const id = this.data.counters.transactions;
      const now = new Date().toISOString();
      const tx = {
        id,
        user_id: params[0],
        amount: params[1],
        type: params[2],
        description: params[3],
        created_at: now
      };
      this.data.transactions.push(tx);
      this.save();
      return { lastID: id, changes: 1 };
    }

    if (sqlUpper.startsWith('INSERT INTO REFERRALS')) {
      this.data.counters.referrals += 1;
      const id = this.data.counters.referrals;
      const now = new Date().toISOString();
      const ref = {
        id,
        referrer_id: params[0],
        referee_id: params[1],
        level: params[2],
        commission_earned: params[3],
        created_at: now
      };
      this.data.referrals.push(ref);
      this.save();
      return { lastID: id, changes: 1 };
    }

    return { lastID: 0, changes: 0 };
  }

  async get(sql, params = []) {
    this.load();
    const sqlUpper = sql.toUpperCase();

    if (sqlUpper.includes('FROM USERS WHERE EMAIL =')) {
      const email = params[0];
      return this.data.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase()) || null;
    }

    if (sqlUpper.includes('FROM USERS WHERE REFERRAL_CODE =')) {
      const code = params[0];
      return this.data.users.find(u => u.referral_code === code) || null;
    }

    if (sqlUpper.includes('FROM USERS WHERE ID =')) {
      const id = params[0];
      return this.data.users.find(u => u.id === Number(id)) || null;
    }

    if (sqlUpper.includes('COUNT(*) AS COUNT FROM USERS WHERE PAID_STATUS = 1')) {
      const count = this.data.users.filter(u => u.paid_status === 1 && u.role === 'agent').length;
      return { count };
    }

    if (sqlUpper.includes('COUNT(*) AS COUNT FROM USERS WHERE ROLE =')) {
      const count = this.data.users.filter(u => u.role === params[0]).length;
      return { count };
    }

    if (sqlUpper.includes('SUM(COMMISSION_EARNED)')) {
      const matching = this.data.referrals;
      const total = matching.reduce((sum, r) => sum + Number(r.commission_earned), 0);
      return { total };
    }

    return null;
  }

  async all(sql, params = []) {
    this.load();
    const sqlUpper = sql.toUpperCase();

    if (sqlUpper.includes('FROM USERS WHERE ROLE =') || sqlUpper.includes('FROM USERS')) {
      if (params.length > 0 && params[0] === 'agent') {
        return this.data.users.filter(u => u.role === 'agent');
      }
      return this.data.users;
    }

    if (sqlUpper.includes('FROM TRANSACTIONS')) {
      if (params.length > 0) {
        const userId = params[0];
        return this.data.transactions.filter(t => t.user_id === Number(userId));
      }
      return this.data.transactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    if (sqlUpper.includes('FROM REFERRALS')) {
      const referrerId = params[0];
      const level = params[1];
      let matches = this.data.referrals.filter(r => r.referrer_id === Number(referrerId));
      if (level) matches = matches.filter(r => r.level === Number(level));

      return matches.map(r => {
        const referee = this.data.users.find(u => u.id === r.referee_id);
        return {
          ...r,
          referee_name: referee ? referee.name : 'Unknown User',
          referee_email: referee ? referee.email : ''
        };
      });
    }

    return [];
  }
}

// Database Engine Wrapper
let dbEngine = null;

if (sqlite3) {
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('[Backend DB] SQLite error:', err);
    else console.log('[Backend DB] SQLite connected at', dbPath);
  });

  dbEngine = {
    isNative: true,
    run(sql, params = []) {
      return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
          if (err) return reject(err);
          resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    },
    get(sql, params = []) {
      return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
          if (err) return reject(err);
          resolve(row || null);
        });
      });
    },
    all(sql, params = []) {
      return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      });
    },
    exec(sql) {
      return new Promise((resolve, reject) => {
        db.exec(sql, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }
  };
} else {
  dbEngine = new FallbackDB(jsonDbPath);
}

// Seed Default Admin Account
async function initDb() {
  if (dbEngine.isNative) {
    const schema = `
      CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT DEFAULT 'agent',
          referral_code TEXT UNIQUE NOT NULL,
          referred_by INTEGER NULL,
          wallet_balance REAL DEFAULT 0.00,
          paid_status INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (referred_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          amount REAL NOT NULL,
          type TEXT NOT NULL,
          description TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS referrals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          referrer_id INTEGER NOT NULL,
          referee_id INTEGER NOT NULL,
          level INTEGER NOT NULL,
          commission_earned REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (referrer_id) REFERENCES users(id),
          FOREIGN KEY (referee_id) REFERENCES users(id)
      );
    `;
    await dbEngine.exec(schema);
  }

  // Seed default admin user if not existing
  const adminEmail = 'admin@ramnet.com';
  const existingAdmin = await dbEngine.get('SELECT id FROM users WHERE email = ?', [adminEmail]);
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin123password', 10);
    await dbEngine.run(
      'INSERT INTO users (name, email, password, role, referral_code, referred_by, wallet_balance, paid_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['RAM System Admin', adminEmail, hashedPassword, 'admin', 'RAMADMIN001', null, 0.00, 1]
    );
    console.log('[Backend DB] Default Admin account seeded: admin@ramnet.com / admin123password');
  }
}

initDb().catch(err => console.error('[Backend DB Init Error]', err));

module.exports = dbEngine;
