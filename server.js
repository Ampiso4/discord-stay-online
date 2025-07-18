const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const BotManager = require("./botManager");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Initialize bot manager
const botManager = new BotManager();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Send current bot status to new client
  socket.emit("botsUpdate", botManager.getAllBots());
  socket.emit("statsUpdate", botManager.getStatusCounts());

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Broadcast updates to all connected clients
function broadcastUpdate() {
  io.emit("botsUpdate", botManager.getAllBots());
  io.emit("statsUpdate", botManager.getStatusCounts());
}

// API Routes

// Get all bots
app.get("/api/bots", (req, res) => {
  res.json({
    success: true,
    bots: botManager.getAllBots(),
    stats: botManager.getStatusCounts(),
  });
});

// Add new bot
app.post("/api/bots", (req, res) => {
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

  const result = botManager.addBot(token, (error, data) => {
    if (error) {
      botManager.updateBotStatus(data.tokenId, "error", error.message);
    } else {
      botManager.updateBotStatus(data.tokenId, data.status);
    }
    broadcastUpdate();
  });

  if (result.success) {
    res.json({
      success: true,
      tokenId: result.tokenId,
      message: "Bot added successfully",
    });
    broadcastUpdate();
  } else {
    res.status(400).json({
      success: false,
      error: result.error,
    });
  }
});

// Toggle bot (start/stop)
app.put("/api/bots/:tokenId/toggle", (req, res) => {
  const tokenId = parseInt(req.params.tokenId);
  const result = botManager.toggleBot(tokenId);

  if (result.success) {
    res.json({
      success: true,
      status: result.status,
      message: `Bot ${result.status}`,
    });
    broadcastUpdate();
  } else {
    res.status(404).json({
      success: false,
      error: result.error,
    });
  }
});

// Remove bot
app.delete("/api/bots/:tokenId", (req, res) => {
  const tokenId = parseInt(req.params.tokenId);
  const result = botManager.removeBot(tokenId);

  if (result.success) {
    res.json({
      success: true,
      message: "Bot removed successfully",
    });
    broadcastUpdate();
  } else {
    res.status(404).json({
      success: false,
      error: result.error,
    });
  }
});

// Get specific bot
app.get("/api/bots/:tokenId", (req, res) => {
  const tokenId = parseInt(req.params.tokenId);
  const bot = botManager.getBot(tokenId);

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
});

// Health check endpoint (replaces keep_alive.js)
app.get("/health", (req, res) => {
  res.json({
    status: "alive",
    timestamp: new Date().toISOString(),
    botCount: botManager.getBotCount(),
    stats: botManager.getStatusCounts(),
  });
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
