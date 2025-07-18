const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcrypt");

class Database {
  constructor() {
    this.db = null;
    this.init();
  }

  init() {
    const dbPath = path.join(__dirname, "discord.db");
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("Error opening database:", err);
      } else {
        console.log("Connected to SQLite database");
        this.createTables();
      }
    });
  }

  createTables() {
    const createUsers = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createBots = `
      CREATE TABLE IF NOT EXISTS bots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_preview TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        status TEXT DEFAULT 'offline',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_error TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `;

    const createConnectionHistory = `
      CREATE TABLE IF NOT EXISTS connection_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bot_id) REFERENCES bots (id) ON DELETE CASCADE
      )
    `;

    this.db.serialize(() => {
      this.db.run(createUsers);
      this.db.run(createBots);
      this.db.run(createConnectionHistory);
      console.log("Database tables created successfully");
    });
  }

  // User operations
  async createUser(sessionId) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO users (session_id, created_at, last_active) 
        VALUES (?, datetime('now'), datetime('now'))
      `;

      this.db.run(query, [sessionId], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, sessionId });
        }
      });
    });
  }

  async getUserBySessionId(sessionId) {
    return new Promise((resolve, reject) => {
      const query = "SELECT * FROM users WHERE session_id = ?";

      this.db.get(query, [sessionId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async updateUserLastActive(userId) {
    return new Promise((resolve, reject) => {
      const query =
        'UPDATE users SET last_active = datetime("now") WHERE id = ?';

      this.db.run(query, [userId], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  // Bot operations
  async createBot(userId, token, tokenPreview) {
    return new Promise(async (resolve, reject) => {
      try {
        const tokenHash = await bcrypt.hash(token, 10);
        const query = `
          INSERT INTO bots (user_id, token_preview, token_hash, status, created_at) 
          VALUES (?, ?, ?, 'connecting', datetime('now'))
        `;

        this.db.run(query, [userId, tokenPreview, tokenHash], function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({
              id: this.lastID,
              userId,
              tokenPreview,
              status: "connecting",
            });
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async getBotsByUserId(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT id, token_preview, status, created_at, last_error 
        FROM bots 
        WHERE user_id = ? 
        ORDER BY created_at DESC
      `;

      this.db.all(query, [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getBotToken(botId, userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT token_hash 
        FROM bots 
        WHERE id = ? AND user_id = ?
      `;

      this.db.get(query, [botId, userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? row.token_hash : null);
        }
      });
    });
  }

  async updateBotStatus(botId, userId, status, lastError = null) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE bots 
        SET status = ?, last_error = ? 
        WHERE id = ? AND user_id = ?
      `;

      this.db.run(query, [status, lastError, botId, userId], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  async deleteBot(botId, userId) {
    return new Promise((resolve, reject) => {
      const query = "DELETE FROM bots WHERE id = ? AND user_id = ?";

      this.db.run(query, [botId, userId], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  // Connection history operations
  async addConnectionHistory(botId, type, message) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO connection_history (bot_id, type, message, timestamp) 
        VALUES (?, ?, ?, datetime('now'))
      `;

      this.db.run(query, [botId, type, message], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  async getConnectionHistory(botId, userId, limit = 10) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT ch.type, ch.message, ch.timestamp 
        FROM connection_history ch
        JOIN bots b ON ch.bot_id = b.id
        WHERE ch.bot_id = ? AND b.user_id = ?
        ORDER BY ch.timestamp DESC
        LIMIT ?
      `;

      this.db.all(query, [botId, userId, limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Clean up old connection history
  async cleanupConnectionHistory(botId, keepLast = 10) {
    return new Promise((resolve, reject) => {
      const query = `
        DELETE FROM connection_history 
        WHERE bot_id = ? AND id NOT IN (
          SELECT id FROM connection_history 
          WHERE bot_id = ? 
          ORDER BY timestamp DESC 
          LIMIT ?
        )
      `;

      this.db.run(query, [botId, botId, keepLast], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  // Get user statistics
  async getUserStats(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online,
          SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline,
          SUM(CASE WHEN status = 'connecting' THEN 1 ELSE 0 END) as connecting
        FROM bots 
        WHERE user_id = ?
      `;

      this.db.get(query, [userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            total: row.total || 0,
            online: row.online || 0,
            offline: row.offline || 0,
            connecting: row.connecting || 0,
          });
        }
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error("Error closing database:", err);
        } else {
          console.log("Database connection closed");
        }
      });
    }
  }
}

module.exports = Database;
