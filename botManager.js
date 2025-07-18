const Eris = require("eris");

class BotManager {
  constructor() {
    this.bots = new Map(); // Store bot instances by token ID
    this.tokenCounter = 0;
  }

  // Add a new bot with a token
  addBot(token, callback) {
    const tokenId = ++this.tokenCounter;

    try {
      const bot = new Eris(token);

      // Store bot info with simplified tracking
      this.bots.set(tokenId, {
        bot: bot,
        token: token,
        status: "connecting",
        createdAt: new Date(),
        lastError: null,
        connectionHistory: [],
      });

      console.log(`Bot ${tokenId}: Connecting to Discord...`);

      // Event handlers
      bot.on("connect", () => {
        console.log(`Bot ${tokenId}: Connected to Discord`);
        this.updateBotStatus(tokenId, "online", null);
        this.addConnectionHistory(
          tokenId,
          "success",
          "Successfully connected to Discord"
        );
        if (callback) callback(null, { status: "online", tokenId });
      });

      bot.on("error", (err) => {
        console.error(`Bot ${tokenId} error:`, err);
        const errorDetails = this.categorizeError(err);
        this.updateBotStatus(tokenId, "offline", errorDetails.message);
        this.addConnectionHistory(tokenId, "error", errorDetails.message);
        if (callback)
          callback(err, {
            status: "offline",
            tokenId,
            error: errorDetails.message,
            errorType: errorDetails.type,
          });
      });

      bot.on("disconnect", (err) => {
        console.log(
          `Bot ${tokenId} disconnected`,
          err ? `with error: ${err.message}` : ""
        );
        this.updateBotStatus(tokenId, "offline", err ? err.message : null);
        this.addConnectionHistory(
          tokenId,
          "disconnect",
          err ? err.message : "Clean disconnect"
        );
        if (callback) callback(null, { status: "offline", tokenId });
      });

      // Connect the bot
      bot.connect().catch((err) => {
        console.error(`Bot ${tokenId} connection failed:`, err);
        const errorDetails = this.categorizeError(err);
        this.updateBotStatus(tokenId, "offline", errorDetails.message);
        this.addConnectionHistory(tokenId, "error", errorDetails.message);
      });

      return { success: true, tokenId };
    } catch (error) {
      console.error(`Failed to create bot ${tokenId}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Add connection history entry
  addConnectionHistory(tokenId, type, message) {
    const botInfo = this.bots.get(tokenId);
    if (botInfo) {
      botInfo.connectionHistory.push({
        timestamp: new Date(),
        type: type,
        message: message,
      });
      // Keep only last 10 entries
      if (botInfo.connectionHistory.length > 10) {
        botInfo.connectionHistory.shift();
      }
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

  // Remove a bot by token ID
  removeBot(tokenId) {
    const botInfo = this.bots.get(tokenId);
    if (botInfo) {
      try {
        botInfo.bot.disconnect();
      } catch (error) {
        console.error(`Error disconnecting bot ${tokenId}:`, error);
      }
      this.bots.delete(tokenId);
      return { success: true };
    }
    return { success: false, error: "Bot not found" };
  }

  // Toggle bot connection (start/stop)
  toggleBot(tokenId) {
    const botInfo = this.bots.get(tokenId);
    if (!botInfo) {
      return { success: false, error: "Bot not found" };
    }

    try {
      if (botInfo.status === "online") {
        botInfo.bot.disconnect();
        botInfo.status = "offline";
      } else {
        botInfo.bot.connect();
        botInfo.status = "connecting";
      }
      return { success: true, status: botInfo.status };
    } catch (error) {
      console.error(`Error toggling bot ${tokenId}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Get all bots status
  getAllBots() {
    const botsList = [];
    for (const [tokenId, botInfo] of this.bots) {
      botsList.push({
        tokenId: tokenId,
        tokenPreview: this.maskToken(botInfo.token),
        status: botInfo.status,
        createdAt: botInfo.createdAt,
        lastError: botInfo.lastError,
        connectionHistory: botInfo.connectionHistory || [],
      });
    }
    return botsList;
  }

  // Get specific bot status
  getBot(tokenId) {
    const botInfo = this.bots.get(tokenId);
    if (!botInfo) {
      return null;
    }
    return {
      tokenId: tokenId,
      tokenPreview: this.maskToken(botInfo.token),
      status: botInfo.status,
      createdAt: botInfo.createdAt,
      lastError: botInfo.lastError,
      connectionHistory: botInfo.connectionHistory || [],
    };
  }

  // Update bot status
  updateBotStatus(tokenId, status, error = null) {
    const botInfo = this.bots.get(tokenId);
    if (botInfo) {
      botInfo.status = status;
      botInfo.lastError = error;
    }
  }

  // Mask token for display (show only last 4 characters)
  maskToken(token) {
    if (!token || token.length < 4) return "****";
    return "*".repeat(token.length - 4) + token.slice(-4);
  }

  // Get total count of bots
  getBotCount() {
    return this.bots.size;
  }

  // Get count by status
  getStatusCounts() {
    const counts = { online: 0, offline: 0, connecting: 0 };
    for (const [, botInfo] of this.bots) {
      if (counts.hasOwnProperty(botInfo.status)) {
        counts[botInfo.status] += 1;
      }
    }
    return counts;
  }
}

module.exports = BotManager;
