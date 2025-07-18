const { v4: uuidv4 } = require("uuid");

class SessionManager {
  constructor(database) {
    this.db = database;
  }

  // Generate a new session ID
  generateSessionId() {
    return uuidv4();
  }

  // Create or get user session
  async createOrGetSession(sessionId = null) {
    try {
      // If no session ID provided, generate a new one
      if (!sessionId) {
        sessionId = this.generateSessionId();
      }

      // Check if user already exists
      let user = await this.db.getUserBySessionId(sessionId);

      if (user) {
        // Update last active time
        await this.db.updateUserLastActive(user.id);
        return user;
      } else {
        // Create new user
        const newUser = await this.db.createUser(sessionId);
        console.log(`New user created with session ID: ${sessionId}`);
        return {
          id: newUser.id,
          session_id: sessionId,
          created_at: new Date(),
          last_active: new Date(),
        };
      }
    } catch (error) {
      console.error("Error creating/getting session:", error);
      throw error;
    }
  }

  // Validate session and get user
  async validateSession(sessionId) {
    try {
      if (!sessionId) {
        return null;
      }

      const user = await this.db.getUserBySessionId(sessionId);
      if (user) {
        // Update last active time
        await this.db.updateUserLastActive(user.id);
        return user;
      }

      return null;
    } catch (error) {
      console.error("Error validating session:", error);
      return null;
    }
  }

  // Middleware to ensure user session exists
  async ensureSession(req, res, next) {
    try {
      let sessionId = req.session.sessionId;

      // If no session ID in session, check if client sent one
      if (!sessionId && req.body.sessionId) {
        sessionId = req.body.sessionId;
      }

      // Create or get session
      const user = await this.createOrGetSession(sessionId);

      // Store in session
      req.session.sessionId = user.session_id;
      req.session.userId = user.id;

      // Attach user to request
      req.user = user;

      next();
    } catch (error) {
      console.error("Session middleware error:", error);
      res.status(500).json({
        success: false,
        error: "Session error",
      });
    }
  }

  // Middleware to validate existing session
  async requireSession(req, res, next) {
    try {
      const sessionId = req.session.sessionId;

      if (!sessionId) {
        return res.status(401).json({
          success: false,
          error: "No session found",
        });
      }

      const user = await this.validateSession(sessionId);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: "Invalid session",
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error("Session validation error:", error);
      res.status(500).json({
        success: false,
        error: "Session validation error",
      });
    }
  }

  // Clean up old sessions (optional - for maintenance)
  async cleanupOldSessions(daysOld = 30) {
    try {
      // This would be implemented if we want to clean up old inactive sessions
      // For now, we'll keep it simple and not implement automatic cleanup
      console.log("Session cleanup not implemented yet");
    } catch (error) {
      console.error("Error cleaning up sessions:", error);
    }
  }

  // Get session info for client
  getSessionInfo(req) {
    return {
      sessionId: req.session.sessionId,
      userId: req.user ? req.user.id : null,
      isAuthenticated: !!req.user,
    };
  }

  // Destroy session
  async destroySession(req) {
    return new Promise((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

module.exports = SessionManager;
