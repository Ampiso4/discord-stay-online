// Initialize Socket.IO connection
const socket = io();

// DOM elements
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const mobileHeader = document.getElementById("mobileHeader");
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const mainContent = document.getElementById("mainContent");
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

// Settings elements
const sessionIdElement = document.getElementById("sessionId");
const userIdElement = document.getElementById("userId");
const connectionStatusElement = document.getElementById("connectionStatus");

// Navigation elements
const navItems = document.querySelectorAll(".nav-item");
const contentSections = document.querySelectorAll(".content-section");

// State
let bots = [];
let stats = { online: 0, offline: 0, connecting: 0 };
let userSession = null;
let currentSection = "dashboard";

// Initialize the application
document.addEventListener("DOMContentLoaded", function () {
  initializeEventListeners();
  initializeNavigation();
  initializeMobileDetection();
  loadInitialData();
});

// Initialize event listeners
function initializeEventListeners() {
  // Form submission
  addBotForm.addEventListener("submit", handleAddBot);

  // Toggle token visibility
  toggleTokenBtn.addEventListener("click", toggleTokenVisibility);

  // Mobile menu toggle
  mobileMenuBtn.addEventListener("click", toggleMobileSidebar);

  // Navigation
  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      const section = e.currentTarget.dataset.section;
      showSection(section);
    });
  });

  // Socket.IO events
  socket.on("botsUpdate", handleBotsUpdate);
  socket.on("statsUpdate", handleStatsUpdate);
  socket.on("connect", () => {
    showToast("Connected to server", "success");
    updateConnectionStatus("Connected");
    // Re-join user room if we have session info
    if (userSession && userSession.sessionId) {
      socket.emit("joinUserRoom", userSession.sessionId);
    }
  });
  socket.on("disconnect", () => {
    showToast("Disconnected from server", "error");
    updateConnectionStatus("Disconnected");
  });
  socket.on("joinedUserRoom", (data) => {
    showToast(`Connected to user session`, "success");
    updateConnectionStatus("Connected");
  });
  socket.on("joinUserRoomError", (error) => {
    console.error("Failed to join user room:", error);
    showToast(`Session error: ${error}`, "error");
    updateConnectionStatus("Error");
  });
  socket.on("connect_error", (error) => {
    console.error("Connection error:", error);
    showToast("Connection error", "error");
    updateConnectionStatus("Error");
  });
  socket.on("reconnect", () => {
    showToast("Reconnected to server", "success");
    updateConnectionStatus("Connected");
    loadInitialData();
  });

  // Window resize
  window.addEventListener("resize", handleResize);

  // Close sidebar when clicking outside on mobile
  document.addEventListener("click", (e) => {
    if (
      window.innerWidth <= 768 &&
      sidebar.classList.contains("open") &&
      !sidebar.contains(e.target) &&
      !mobileMenuBtn.contains(e.target)
    ) {
      closeMobileSidebar();
    }
  });
}

// Initialize navigation
function initializeNavigation() {
  // Set initial active section
  showSection("dashboard");
}

// Initialize mobile detection
function initializeMobileDetection() {
  handleResize();
}

// Handle window resize
function handleResize() {
  if (window.innerWidth <= 768) {
    // Mobile layout
    mobileHeader.style.display = "flex";
  } else {
    // Desktop layout
    mobileHeader.style.display = "none";
    sidebar.classList.remove("open");
  }
}

// Toggle mobile sidebar
function toggleMobileSidebar() {
  sidebar.classList.toggle("open");
}

// Close mobile sidebar
function closeMobileSidebar() {
  sidebar.classList.remove("open");
}

// Show section
function showSection(sectionName) {
  // Update navigation
  navItems.forEach((item) => {
    item.classList.remove("active");
    if (item.dataset.section === sectionName) {
      item.classList.add("active");
    }
  });

  // Update content sections
  contentSections.forEach((section) => {
    section.style.display = "none";
  });

  const targetSection = document.getElementById(`${sectionName}-section`);
  if (targetSection) {
    targetSection.style.display = "block";
  }

  currentSection = sectionName;

  // Close mobile sidebar after navigation
  if (window.innerWidth <= 768) {
    closeMobileSidebar();
  }

  // Focus token input when showing add-bot section
  if (sectionName === "add-bot") {
    setTimeout(() => {
      tokenInput.focus();
    }, 100);
  }
}

// Load initial data
async function loadInitialData() {
  try {
    const response = await fetch("/api/bots");
    const data = await response.json();

    if (data.success) {
      bots = data.bots;
      stats = data.stats;
      userSession = data.sessionInfo;

      // Update session info in settings
      if (userSession) {
        if (sessionIdElement)
          sessionIdElement.textContent = userSession.sessionId || "N/A";
        if (userIdElement)
          userIdElement.textContent = userSession.userId || "N/A";

        // Join user-specific WebSocket room
        if (userSession.sessionId) {
          socket.emit("joinUserRoom", userSession.sessionId);
        }
      }

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
  addBotBtn.innerHTML = `
        <div class="loading-spinner" style="margin-right: 8px;"></div>
        Adding Bot...
    `;

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
      // Switch to bots section to show the new bot
      showSection("bots");
    } else {
      showToast(`Error: ${data.error}`, "error");
    }
  } catch (error) {
    console.error("Error adding bot:", error);
    showToast("Error adding bot", "error");
  } finally {
    // Re-enable form
    addBotBtn.disabled = false;
    addBotBtn.innerHTML = `
            <span style="margin-right: 8px;">➕</span>
            Add Bot
        `;
  }
}

// Toggle token visibility
function toggleTokenVisibility() {
  const type = tokenInput.type === "password" ? "text" : "password";
  tokenInput.type = type;
  const toggleSpan = toggleTokenBtn.querySelector("span");
  toggleSpan.textContent = type === "password" ? "👁️" : "🙈";
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

  // Update sidebar stats
  const sidebarOnlineCount = document.getElementById("sidebarOnlineCount");
  const sidebarTotalCount = document.getElementById("sidebarTotalCount");
  const botCountBadge = document.getElementById("botCountBadge");

  if (sidebarOnlineCount) sidebarOnlineCount.textContent = stats.online || 0;
  if (sidebarTotalCount) sidebarTotalCount.textContent = total;
  if (botCountBadge) botCountBadge.textContent = total;
}

// Update bots UI
function updateBotsUI() {
  if (bots.length === 0) {
    botsContainer.innerHTML = `
            <div class="no-bots">
                <p>No bots added yet. Add your first bot using the Add Bot section.</p>
            </div>
        `;
    return;
  }

  const botsHTML = bots.map((bot) => createBotCard(bot)).join("");
  botsContainer.innerHTML = botsHTML;
}

// Create bot card HTML
function createBotCard(bot) {
  const createdAt = new Date(bot.createdAt).toLocaleString();
  const statusClass = bot.status;
  const isOnline = bot.status === "online";
  const connectionHistory = bot.connectionHistory || [];

  return `
        <div class="bot-card ${statusClass}" data-token-id="${bot.tokenId}">
            <div class="bot-header">
                <div class="bot-token">${bot.tokenPreview}</div>
                <div class="bot-status">
                    <span class="status-indicator ${statusClass}"></span>
                    <span class="status-text ${statusClass}">${formatStatusText(
    bot.status
  )}</span>
                </div>
                <div class="bot-controls">
                    <button class="btn-secondary ${isOnline ? "active" : ""}" 
                            onclick="toggleBot(${bot.tokenId})">
                        ${isOnline ? "Stop" : "Start"}
                    </button>
                    <button class="btn-danger" onclick="removeBot(${
                      bot.tokenId
                    })">
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
                    <div class="bot-info-value">${formatStatusText(
                      bot.status
                    )}</div>
                </div>
            </div>

            ${
              bot.lastError
                ? `<div class="error-message">Error: ${bot.lastError}</div>`
                : ""
            }
            
            ${
              connectionHistory.length > 0
                ? createConnectionHistory(connectionHistory, bot.tokenId)
                : ""
            }
        </div>
    `;
}

// Format status text for display
function formatStatusText(status) {
  const statusMap = {
    online: "Online",
    offline: "Offline",
    connecting: "Connecting...",
    error: "Error",
  };
  return statusMap[status] || status;
}

// Create connection history display
function createConnectionHistory(history, tokenId) {
  const recentHistory = history.slice(-5).reverse(); // Show last 5 entries

  return `
        <div class="connection-history-container">
            <button class="toggle-history" onclick="toggleConnectionHistory(${tokenId})">
                Show Connection History (${history.length})
            </button>
            <div class="connection-history" id="history-${tokenId}">
                ${recentHistory
                  .map(
                    (item) => `
                    <div class="connection-history-item">
                        <div>
                            <span class="connection-history-type ${
                              item.type
                            }">${item.type}</span>
                            <span class="connection-history-message">${
                              item.message
                            }</span>
                        </div>
                        <div class="connection-history-time">${new Date(
                          item.timestamp
                        ).toLocaleTimeString()}</div>
                    </div>
                `
                  )
                  .join("")}
            </div>
        </div>
    `;
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

// Toggle connection history visibility
function toggleConnectionHistory(tokenId) {
  const historyElement = document.getElementById(`history-${tokenId}`);
  const toggleButton = historyElement.previousElementSibling;

  if (historyElement.classList.contains("expanded")) {
    historyElement.classList.remove("expanded");
    toggleButton.textContent = toggleButton.textContent.replace("Hide", "Show");
  } else {
    historyElement.classList.add("expanded");
    toggleButton.textContent = toggleButton.textContent.replace("Show", "Hide");
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

// Update connection status
function updateConnectionStatus(status) {
  if (connectionStatusElement) {
    connectionStatusElement.textContent = status;
    connectionStatusElement.style.color =
      status === "Connected"
        ? "var(--status-online)"
        : status === "Disconnected"
        ? "var(--status-offline)"
        : "var(--status-error)";
  }
}

// Refresh data
async function refreshData() {
  showToast("Refreshing data...", "info");
  await loadInitialData();
  showToast("Data refreshed", "success");
}

// Global functions for HTML onclick handlers
window.showSection = showSection;
window.toggleBot = toggleBot;
window.removeBot = removeBot;
window.toggleConnectionHistory = toggleConnectionHistory;
window.refreshData = refreshData;

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
  // Ctrl/Cmd + Enter to add bot (only in add-bot section)
  if (
    (e.ctrlKey || e.metaKey) &&
    e.key === "Enter" &&
    currentSection === "add-bot"
  ) {
    e.preventDefault();
    if (tokenInput.value.trim()) {
      handleAddBot(e);
    }
  }

  // Escape to clear token input or close mobile sidebar
  if (e.key === "Escape") {
    if (currentSection === "add-bot") {
      tokenInput.value = "";
      tokenInput.blur();
    } else if (window.innerWidth <= 768 && sidebar.classList.contains("open")) {
      closeMobileSidebar();
    }
  }

  // Number keys for quick navigation (1-4)
  if (e.key >= "1" && e.key <= "4" && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const sections = ["dashboard", "bots", "add-bot", "settings"];
    const sectionIndex = parseInt(e.key) - 1;
    if (sections[sectionIndex]) {
      showSection(sections[sectionIndex]);
    }
  }
});

// Prevent form submission when pressing Enter in other inputs
document.addEventListener("keypress", (e) => {
  if (
    e.key === "Enter" &&
    e.target.tagName === "INPUT" &&
    e.target.type !== "submit"
  ) {
    if (e.target.id === "tokenInput") {
      handleAddBot(e);
    }
  }
});

// Service Worker registration (for future PWA features)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // Service worker registration could be added here in the future
  });
}

// Initialize theme detection
function initializeTheme() {
  // Could add theme switching logic here in the future
  document.body.classList.add("cyberpunk-theme");
}

// Call theme initialization
initializeTheme();

// Add smooth scrolling for better UX
document.documentElement.style.scrollBehavior = "smooth";

// Add loading states for better UX
function showLoading(element, text = "Loading...") {
  const originalHTML = element.innerHTML;
  element.innerHTML = `
        <div class="loading-spinner" style="margin-right: 8px;"></div>
        ${text}
    `;
  element.disabled = true;
  return originalHTML;
}

function hideLoading(element, originalHTML) {
  element.innerHTML = originalHTML;
  element.disabled = false;
}

// Performance monitoring
const perfObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === "navigation") {
      console.log("Page load time:", entry.loadEventEnd - entry.loadEventStart);
    }
  }
});

if (window.PerformanceObserver) {
  perfObserver.observe({ type: "navigation", buffered: true });
}
