// Initialize Socket.IO connection
const socket = io();

// DOM elements
const addBotForm = document.getElementById("addBotForm");
const tokenInput = document.getElementById("tokenInput");
const toggleTokenBtn = document.getElementById("toggleToken");
const addBotBtn = document.getElementById("addBotBtn");
const botsContainer = document.getElementById("botsContainer");
const toast = document.getElementById("toast");

// Stats elements
const totalBotsElement = document.getElementById("totalBots");
const onlineBotsElement = document.getElementById("onlineBots");
const offlineBotsElement = document.getElementById("offlineBots");
const connectingBotsElement = document.getElementById("connectingBots");
const errorBotsElement = document.getElementById("errorBots");

// State
let bots = [];
let stats = { online: 0, offline: 0, connecting: 0, error: 0 };

// Initialize the application
document.addEventListener("DOMContentLoaded", function () {
  initializeEventListeners();
  loadInitialData();
});

// Initialize event listeners
function initializeEventListeners() {
  // Form submission
  addBotForm.addEventListener("submit", handleAddBot);

  // Toggle token visibility
  toggleTokenBtn.addEventListener("click", toggleTokenVisibility);

  // Socket.IO events
  socket.on("botsUpdate", handleBotsUpdate);
  socket.on("statsUpdate", handleStatsUpdate);
  socket.on("connect", () => {
    console.log("Connected to server");
    showToast("Connected to server", "success");
  });
  socket.on("disconnect", () => {
    console.log("Disconnected from server");
    showToast("Disconnected from server", "error");
  });
}

// Load initial data
async function loadInitialData() {
  try {
    const response = await fetch("/api/bots");
    const data = await response.json();

    if (data.success) {
      bots = data.bots;
      stats = data.stats;
      updateUI();
    }
  } catch (error) {
    console.error("Error loading initial data:", error);
    showToast("Error loading initial data", "error");
  }
}

// Handle add bot form submission
async function handleAddBot(e) {
  e.preventDefault();

  const token = tokenInput.value.trim();

  if (!token) {
    showToast("Please enter a Discord token", "warning");
    return;
  }

  if (token.length < 50) {
    showToast("Invalid token format", "error");
    return;
  }

  // Disable form during submission
  addBotBtn.disabled = true;
  addBotBtn.textContent = "Adding Bot...";

  try {
    const response = await fetch("/api/bots", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });

    const data = await response.json();

    if (data.success) {
      showToast("Bot added successfully", "success");
      tokenInput.value = "";
    } else {
      showToast(`Error: ${data.error}`, "error");
    }
  } catch (error) {
    console.error("Error adding bot:", error);
    showToast("Error adding bot", "error");
  } finally {
    // Re-enable form
    addBotBtn.disabled = false;
    addBotBtn.textContent = "Add Bot";
  }
}

// Toggle token visibility
function toggleTokenVisibility() {
  const type = tokenInput.type === "password" ? "text" : "password";
  tokenInput.type = type;
  toggleTokenBtn.textContent = type === "password" ? "👁️" : "🙈";
}

// Handle bots update from server
function handleBotsUpdate(updatedBots) {
  bots = updatedBots;
  updateBotsUI();
}

// Handle stats update from server
function handleStatsUpdate(updatedStats) {
  stats = updatedStats;
  updateStatsUI();
}

// Update the entire UI
function updateUI() {
  updateStatsUI();
  updateBotsUI();
}

// Update stats UI
function updateStatsUI() {
  const total = bots.length;
  totalBotsElement.textContent = total;
  onlineBotsElement.textContent = stats.online || 0;
  offlineBotsElement.textContent = stats.offline || 0;
  connectingBotsElement.textContent = stats.connecting || 0;
  errorBotsElement.textContent = stats.error || 0;
}

// Update bots UI
function updateBotsUI() {
  if (bots.length === 0) {
    botsContainer.innerHTML = `
            <div class="no-bots">
                <p>No bots added yet. Add your first bot using the form above.</p>
            </div>
        `;
    return;
  }

  const botsHTML = bots.map((bot) => createBotCard(bot)).join("");
  botsContainer.innerHTML = botsHTML;

  // Add event listeners to bot controls
  addBotControlListeners();
}

// Create bot card HTML
function createBotCard(bot) {
  const createdAt = new Date(bot.createdAt).toLocaleString();
  const statusClass = bot.status;
  const isOnline = bot.status === "online";

  return `
        <div class="bot-card ${statusClass}" data-token-id="${bot.tokenId}">
            <div class="bot-header">
                <div class="bot-token">${bot.tokenPreview}</div>
                <div class="bot-status">
                    <span class="status-indicator ${statusClass}"></span>
                    <span class="status-text ${statusClass}">${
    bot.status
  }</span>
                </div>
                <div class="bot-controls">
                    <button class="toggle-btn ${isOnline ? "active" : ""}" 
                            data-token-id="${bot.tokenId}" 
                            onclick="toggleBot(${bot.tokenId})">
                        ${isOnline ? "Stop" : "Start"}
                    </button>
                    <button class="remove-btn" 
                            data-token-id="${bot.tokenId}" 
                            onclick="removeBot(${bot.tokenId})">
                        Remove
                    </button>
                </div>
            </div>
            <div class="bot-info">
                <div class="bot-info-item">
                    <div class="bot-info-label">Token ID</div>
                    <div class="bot-info-value">#${bot.tokenId}</div>
                </div>
                <div class="bot-info-item">
                    <div class="bot-info-label">Created</div>
                    <div class="bot-info-value">${createdAt}</div>
                </div>
                <div class="bot-info-item">
                    <div class="bot-info-label">Status</div>
                    <div class="bot-info-value">${bot.status.toUpperCase()}</div>
                </div>
            </div>
            ${
              bot.lastError
                ? `<div class="error-message">Error: ${bot.lastError}</div>`
                : ""
            }
        </div>
    `;
}

// Add event listeners to bot controls
function addBotControlListeners() {
  // Event delegation is already handled by onclick attributes in HTML
  // This function is kept for potential future enhancements
}

// Toggle bot (start/stop)
async function toggleBot(tokenId) {
  try {
    const response = await fetch(`/api/bots/${tokenId}/toggle`, {
      method: "PUT",
    });

    const data = await response.json();

    if (data.success) {
      showToast(data.message, "success");
    } else {
      showToast(`Error: ${data.error}`, "error");
    }
  } catch (error) {
    console.error("Error toggling bot:", error);
    showToast("Error toggling bot", "error");
  }
}

// Remove bot
async function removeBot(tokenId) {
  if (!confirm("Are you sure you want to remove this bot?")) {
    return;
  }

  try {
    const response = await fetch(`/api/bots/${tokenId}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (data.success) {
      showToast("Bot removed successfully", "success");
    } else {
      showToast(`Error: ${data.error}`, "error");
    }
  } catch (error) {
    console.error("Error removing bot:", error);
    showToast("Error removing bot", "error");
  }
}

// Show toast notification
function showToast(message, type = "info") {
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 4000);
}

// Handle connection errors
socket.on("connect_error", (error) => {
  console.error("Connection error:", error);
  showToast("Connection error", "error");
});

// Handle reconnection
socket.on("reconnect", () => {
  console.log("Reconnected to server");
  showToast("Reconnected to server", "success");
  loadInitialData();
});

// Auto-refresh stats periodically (fallback)
setInterval(() => {
  if (socket.connected) {
    // Stats will be updated via socket events
    // This is just a fallback in case socket updates fail
  }
}, 30000); // Every 30 seconds

// Handle page visibility changes
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && socket.connected) {
    // Refresh data when page becomes visible
    loadInitialData();
  }
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // Ctrl/Cmd + Enter to add bot
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    if (tokenInput.value.trim()) {
      handleAddBot(e);
    }
  }

  // Escape to clear token input
  if (e.key === "Escape") {
    tokenInput.value = "";
    tokenInput.blur();
  }
});

// Focus token input on page load
window.addEventListener("load", () => {
  tokenInput.focus();
});
