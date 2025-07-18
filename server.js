const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const bodyParser = require("body-parser");
const session = require("express-session");
const path = require("path");

const Database = require("./database");
const SessionManager = require("./sessionManager");
const BotManager = require("./botManager");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Initialize database and managers
const database = new Database();
const sessionManager = new SessionManager(database);
const botManager = new BotManager(database);

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "discord-stay-online-secret-key",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false, // Set to true if using HTTPS
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
    },
  })
);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Socket.IO connection handling with user isolation
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Handle user session for socket
  socket.on("joinUserRoom", async (sessionId) => {
    try {
      const user = await sessionManager.validateSession(sessionId);
      if (user) {
        socket.userId = user.id;
        socket.sessionId = sessionId;
        socket.join(`user_${user.id}`);

        // Send current bot status to this user only
        const bots = await botManager.getAllBots(user.id);
        const stats = await botManager.getUserStats(user.id);

        socket.emit("botsUpdate", bots);
        socket.emit("statsUpdate", stats);
      }
    } catch (error) {
      console.error("Error joining user room:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Broadcast updates to specific user
function broadcastUserUpdate(userId) {
  io.to(`user_${userId}`).emit("botsUpdate", botManager.getAllBots(userId));
  io.to(`user_${userId}`).emit("statsUpdate", botManager.getUserStats(userId));
}

// API Routes

// Get all bots for current user
app.get(
  "/api/bots",
  sessionManager.ensureSession.bind(sessionManager),
  async (req, res) => {
    try {
      const bots = await botManager.getAllBots(req.user.id);
      const stats = await botManager.getUserStats(req.user.id);

      res.json({
        success: true,
        bots: bots,
        stats: stats,
        sessionInfo: sessionManager.getSessionInfo(req),
      });
    } catch (error) {
      console.error("Error getting bots:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get bots",
      });
    }
  }
);

// Add new bot for current user
app.post(
  "/api/bots",
  sessionManager.ensureSession.bind(sessionManager),
  async (req, res) => {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Token is required",
      });
    }

    // Basic token validation
    if (token.length < 50) {
      return res.status(400).json({
        success: false,
        error: "Invalid token format",
      });
    }

    try {
      const result = await botManager.addBot(
        req.user.id,
        token,
        (error, data) => {
          if (error) {
            console.error(`Bot ${data.botId} error:`, error);
          } else {
            console.log(`Bot ${data.botId} status:`, data.status);
          }
          broadcastUserUpdate(req.user.id);
        }
      );

      if (result.success) {
        res.json({
          success: true,
          botId: result.botId,
          message: "Bot added successfully",
        });
        broadcastUserUpdate(req.user.id);
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      console.error("Error adding bot:", error);
      res.status(500).json({
        success: false,
        error: "Failed to add bot",
      });
    }
  }
);

// Toggle bot (start/stop) for current user
app.put(
  "/api/bots/:botId/toggle",
  sessionManager.ensureSession.bind(sessionManager),
  async (req, res) => {
    const botId = parseInt(req.params.botId);

    try {
      const result = await botManager.toggleBot(botId, req.user.id);

      if (result.success) {
        res.json({
          success: true,
          status: result.status,
          message: `Bot ${result.status}`,
        });
        broadcastUserUpdate(req.user.id);
      } else {
        res.status(404).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      console.error("Error toggling bot:", error);
      res.status(500).json({
        success: false,
        error: "Failed to toggle bot",
      });
    }
  }
);

// Remove bot for current user
app.delete(
  "/api/bots/:botId",
  sessionManager.ensureSession.bind(sessionManager),
  async (req, res) => {
    const botId = parseInt(req.params.botId);

    try {
      const result = await botManager.removeBot(botId, req.user.id);

      if (result.success) {
        res.json({
          success: true,
          message: "Bot removed successfully",
        });
        broadcastUserUpdate(req.user.id);
      } else {
        res.status(404).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      console.error("Error removing bot:", error);
      res.status(500).json({
        success: false,
        error: "Failed to remove bot",
      });
    }
  }
);

// Get specific bot for current user
app.get(
  "/api/bots/:botId",
  sessionManager.ensureSession.bind(sessionManager),
  async (req, res) => {
    const botId = parseInt(req.params.botId);

    try {
      const bot = await botManager.getBot(botId, req.user.id);

      if (bot) {
        res.json({
          success: true,
          bot: bot,
        });
      } else {
        res.status(404).json({
          success: false,
          error: "Bot not found",
        });
      }
    } catch (error) {
      console.error("Error getting bot:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get bot",
      });
    }
  }
);

// Session info endpoint
app.get(
  "/api/session",
  sessionManager.ensureSession.bind(sessionManager),
  (req, res) => {
    res.json({
      success: true,
      session: sessionManager.getSessionInfo(req),
    });
  }
);

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    const totalStats = await new Promise((resolve, reject) => {
      database.db.get(
        `
        SELECT 
          COUNT(*) as total_bots,
          COUNT(DISTINCT user_id) as total_users,
          SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online_bots,
          SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline_bots,
          SUM(CASE WHEN status = 'connecting' THEN 1 ELSE 0 END) as connecting_bots
        FROM bots
      `,
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    res.json({
      status: "alive",
      timestamp: new Date().toISOString(),
      totalBots: totalStats?.total_bots || 0,
      totalUsers: totalStats?.total_users || 0,
      stats: {
        online: totalStats?.online_bots || 0,
        offline: totalStats?.offline_bots || 0,
        connecting: totalStats?.connecting_bots || 0,
      },
    });
  } catch (error) {
    console.error("Error getting health status:", error);
    res.json({
      status: "alive",
      timestamp: new Date().toISOString(),
      error: "Could not get detailed stats",
    });
  }
});

// Serve the main UI
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
  });
});

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`Discord Stay Online Server running on port ${PORT}`);
  console.log(`Web UI available at: http://localhost:${PORT}`);
  console.log(`Health check at: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down gracefully...");
  database.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Shutting down gracefully...");
  database.close();
  process.exit(0);
});
