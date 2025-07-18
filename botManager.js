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

      bot.on("ready", () => {
        console.log(`Bot ${tokenId} connected successfully`);
        if (callback) callback(null, { status: "online", tokenId });
      });

      bot.on("error", (err) => {
        console.error(`Bot ${tokenId} error:`, err);
        if (callback)
          callback(err, { status: "error", tokenId, error: err.message });
      });

      bot.on("disconnect", () => {
        console.log(`Bot ${tokenId} disconnected`);
        if (callback) callback(null, { status: "offline", tokenId });
      });

      // Store bot info
      this.bots.set(tokenId, {
        bot: bot,
        token: token,
        status: "connecting",
        createdAt: new Date(),
        lastError: null,
      });

      // Connect the bot
      bot.connect();

      return { success: true, tokenId };
    } catch (error) {
      console.error(`Failed to create bot ${tokenId}:`, error);
      return { success: false, error: error.message };
    }
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
    const counts = { online: 0, offline: 0, connecting: 0, error: 0 };
    for (const [, botInfo] of this.bots) {
      counts[botInfo.status] = (counts[botInfo.status] || 0) + 1;
    }
    return counts;
  }
}

module.exports = BotManager;
