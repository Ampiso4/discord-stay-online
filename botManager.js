const Eris = require("eris");
const bcrypt = require("bcrypt");

class BotManager {
  constructor(database) {
    this.bots = new Map(); // Store active bot instances by bot ID
    this.db = database;
  }

  // Add a new bot with a token for a specific user
  async addBot(userId, token, callback) {
    try {
      const tokenPreview = this.maskToken(token);

      // Save bot to database
      const dbBot = await this.db.createBot(userId, token, tokenPreview);
      const botId = dbBot.id;

      // Create Eris bot instance
      const bot = new Eris(token);

      // Store bot info in memory
      this.bots.set(botId, {
        bot: bot,
        userId: userId,
        status: "connecting",
        createdAt: new Date(),
        lastError: null,
      });

      console.log(`Bot ${botId}: Connecting to Discord...`);

      // Event handlers
      bot.on("connect", async () => {
        console.log(`Bot ${botId}: Connected to Discord`);
        await this.updateBotStatus(botId, userId, "online", null);
        await this.addConnectionHistory(
          botId,
          "success",
          "Successfully connected to Discord"
        );
        if (callback) callback(null, { status: "online", botId });
      });

      bot.on("error", async (err) => {
        console.error(`Bot ${botId} error:`, err);
        const errorDetails = this.categorizeError(err);
        await this.updateBotStatus(
          botId,
          userId,
          "offline",
          errorDetails.message
        );
        await this.addConnectionHistory(botId, "error", errorDetails.message);
        if (callback)
          callback(err, {
            status: "offline",
            botId,
            error: errorDetails.message,
            errorType: errorDetails.type,
          });
      });

      bot.on("disconnect", async (err) => {
        console.log(
          `Bot ${botId} disconnected`,
          err ? `with error: ${err.message}` : ""
        );
        await this.updateBotStatus(
          botId,
          userId,
          "offline",
          err ? err.message : null
        );
        await this.addConnectionHistory(
          botId,
          "disconnect",
          err ? err.message : "Clean disconnect"
        );
        if (callback) callback(null, { status: "offline", botId });
      });

      // Connect the bot
      bot.connect().catch(async (err) => {
        console.error(`Bot ${botId} connection failed:`, err);
        const errorDetails = this.categorizeError(err);
        await this.updateBotStatus(
          botId,
          userId,
          "offline",
          errorDetails.message
        );
        await this.addConnectionHistory(botId, "error", errorDetails.message);
      });

      return { success: true, botId };
    } catch (error) {
      console.error(`Failed to create bot:`, error);
      return { success: false, error: error.message };
    }
  }

  // Add connection history entry
  async addConnectionHistory(botId, type, message) {
    try {
      await this.db.addConnectionHistory(botId, type, message);
      // Clean up old entries
      await this.db.cleanupConnectionHistory(botId, 10);
    } catch (error) {
      console.error(`Error adding connection history for bot ${botId}:`, error);
    }
  }

  // Update bot status in database
  async updateBotStatus(botId, userId, status, error = null) {
    try {
      await this.db.updateBotStatus(botId, userId, status, error);
      // Update in-memory status
      const botInfo = this.bots.get(botId);
      if (botInfo) {
        botInfo.status = status;
        botInfo.lastError = error;
      }
    } catch (dbError) {
      console.error(`Error updating bot status for bot ${botId}:`, dbError);
    }
  }

  // Categorize errors for better user feedback
  categorizeError(error) {
    const errorMessage = error.message || error.toString();
    const errorCode = error.code;

    // Authentication errors
    if (errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
      return {
        type: "authentication",
        message: "Invalid or expired Discord token",
        suggestion: "Please verify your token is correct and hasn't expired",
      };
    }

    // Rate limiting
    if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
      return {
        type: "rate_limit",
        message: "Rate limited by Discord",
        suggestion: "Too many connection attempts. Please wait before retrying",
      };
    }

    // Network errors
    if (
      errorCode === "ENOTFOUND" ||
      errorCode === "ECONNREFUSED" ||
      errorCode === "ETIMEDOUT"
    ) {
      return {
        type: "network",
        message: "Network connection failed",
        suggestion: "Check your internet connection and firewall settings",
      };
    }

    // Discord API errors
    if (errorMessage.includes("403") || errorMessage.includes("Forbidden")) {
      return {
        type: "permission",
        message: "Account suspended or restricted",
        suggestion:
          "Your Discord account may be suspended or require verification",
      };
    }

    // Gateway errors
    if (
      errorMessage.includes("gateway") ||
      errorMessage.includes("websocket")
    ) {
      return {
        type: "gateway",
        message: "Discord gateway connection failed",
        suggestion: "Discord servers may be experiencing issues",
      };
    }

    // Unknown errors
    return {
      type: "unknown",
      message: errorMessage,
      suggestion: "Check console logs for more details",
    };
  }

  // Remove a bot by bot ID and user ID
  async removeBot(botId, userId) {
    try {
      // Disconnect bot if it's running
      const botInfo = this.bots.get(botId);
      if (botInfo) {
        try {
          botInfo.bot.disconnect();
        } catch (error) {
          console.error(`Error disconnecting bot ${botId}:`, error);
        }
        this.bots.delete(botId);
      }

      // Remove from database
      const result = await this.db.deleteBot(botId, userId);
      if (result > 0) {
        return { success: true };
      } else {
        return { success: false, error: "Bot not found" };
      }
    } catch (error) {
      console.error(`Error removing bot ${botId}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Toggle bot connection (start/stop)
  async toggleBot(botId, userId) {
    try {
      const botInfo = this.bots.get(botId);
      if (!botInfo) {
        // Bot not in memory, try to load from database
        const tokenHash = await this.db.getBotToken(botId, userId);
        if (!tokenHash) {
          return { success: false, error: "Bot not found" };
        }
        // Would need to decrypt token here to restart bot
        // For now, return error
        return { success: false, error: "Bot not currently running" };
      }

      if (botInfo.status === "online") {
        botInfo.bot.disconnect();
        await this.updateBotStatus(botId, userId, "offline", null);
        return { success: true, status: "offline" };
      } else {
        botInfo.bot.connect();
        await this.updateBotStatus(botId, userId, "connecting", null);
        return { success: true, status: "connecting" };
      }
    } catch (error) {
      console.error(`Error toggling bot ${botId}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Get all bots for a specific user
  async getAllBots(userId) {
    try {
      const dbBots = await this.db.getBotsByUserId(userId);
      const botsWithHistory = [];

      for (const bot of dbBots) {
        const connectionHistory = await this.db.getConnectionHistory(
          bot.id,
          userId,
          5
        );
        botsWithHistory.push({
          tokenId: bot.id,
          tokenPreview: bot.token_preview,
          status: bot.status,
          createdAt: bot.created_at,
          lastError: bot.last_error,
          connectionHistory: connectionHistory || [],
        });
      }

      return botsWithHistory;
    } catch (error) {
      console.error(`Error getting bots for user ${userId}:`, error);
      return [];
    }
  }

  // Get specific bot status
  async getBot(botId, userId) {
    try {
      // Check in-memory first
      const botInfo = this.bots.get(botId);
      if (botInfo && botInfo.userId === userId) {
        const connectionHistory = await this.db.getConnectionHistory(
          botId,
          userId,
          5
        );
        return {
          tokenId: botId,
          tokenPreview: this.maskToken(botInfo.token),
          status: botInfo.status,
          createdAt: botInfo.createdAt,
          lastError: botInfo.lastError,
          connectionHistory: connectionHistory || [],
        };
      }

      // Get from database
      const dbBots = await this.db.getBotsByUserId(userId);
      const bot = dbBots.find((b) => b.id === botId);

      if (bot) {
        const connectionHistory = await this.db.getConnectionHistory(
          botId,
          userId,
          5
        );
        return {
          tokenId: bot.id,
          tokenPreview: bot.token_preview,
          status: bot.status,
          createdAt: bot.created_at,
          lastError: bot.last_error,
          connectionHistory: connectionHistory || [],
        };
      }

      return null;
    } catch (error) {
      console.error(`Error getting bot ${botId}:`, error);
      return null;
    }
  }

  // Mask token for display (show only last 4 characters)
  maskToken(token) {
    if (!token || token.length < 4) return "****";
    return "*".repeat(token.length - 4) + token.slice(-4);
  }

  // Get user statistics
  async getUserStats(userId) {
    try {
      return await this.db.getUserStats(userId);
    } catch (error) {
      console.error(`Error getting user stats for user ${userId}:`, error);
      return { online: 0, offline: 0, connecting: 0 };
    }
  }

  // Load user's bots on startup
  async loadUserBots(userId) {
    try {
      const dbBots = await this.db.getBotsByUserId(userId);
      // For now, we won't automatically restart bots on server restart
      // This could be implemented later if needed
      console.log(`Found ${dbBots.length} bots for user ${userId}`);
      return dbBots;
    } catch (error) {
      console.error(`Error loading bots for user ${userId}:`, error);
      return [];
    }
  }
}

module.exports = BotManager;
