# Discord Stay Online - Web UI Edition

Keep your Discord profile online forever with an intuitive web interface that supports multiple tokens and real-time monitoring.

## ✨ Features

- 🌐 **Web-based Dashboard**: Modern, responsive web interface
- 🤖 **Multiple Bot Support**: Manage multiple Discord tokens simultaneously
- 📊 **Real-time Status Monitoring**: Live status updates via WebSocket
- 🔄 **Individual Bot Control**: Start/stop each bot independently
- 📈 **Statistics Dashboard**: Overview of all bot statuses
- 🔒 **Token Security**: Tokens are masked in the UI for privacy
- 📱 **Mobile Responsive**: Works on all devices
- 🎨 **Beautiful UI**: Modern gradient design with smooth animations

## 🚀 Quick Start

### Local Installation

1. **Clone the repository**:

```bash
git clone https://github.com/your-username/discord-stay-online.git
cd discord-stay-online
```

2. **Install dependencies**:

```bash
npm install
```

3. **Start the server**:

```bash
npm start
```

4. **Open your browser** and navigate to `http://localhost:8080`

### Using the Web Interface

1. **Add a Discord Token**:

   - Enter your Discord user token in the input field
   - Click "Add Bot" to add it to the system
   - The bot will automatically attempt to connect

2. **Monitor Status**:

   - View real-time status in the statistics cards
   - Each bot shows its current status (Online/Offline/Connecting/Error)
   - Status updates automatically via WebSocket

3. **Control Bots**:
   - Use the toggle switches to start/stop individual bots
   - Remove bots using the "Remove" button
   - All changes are reflected in real-time

## 🔧 Getting Discord Token

1. **Login to Discord** in your web browser
2. **Open Developer Tools** (F12 or Ctrl+Shift+I)
3. **Go to Network tab**
4. **Interact with Discord** (click on a server or channel)
5. **Find a request** and look for "authorization" in the request headers
6. **Copy the token** (it starts with your user ID)

## 🌐 Deployment Options

### Replit (Recommended)

1. Import this repository to Replit
2. Install dependencies: `npm install`
3. Run with: `npm start`
4. Use the provided URL to access the web interface

### Heroku

1. Create a new Heroku app
2. Connect your GitHub repository
3. Deploy the app
4. Access via your Heroku app URL

### VPS/Cloud Server

1. Upload the project to your server
2. Install Node.js and npm
3. Run `npm install && npm start`
4. Access via your server's IP and port 8080

## 📡 Keeping the Service Online

To prevent the service from sleeping (especially on free hosting):

1. **UptimeRobot** (Recommended):

   - Register at https://uptimerobot.com
   - Add HTTP monitor
   - Set URL to your deployment URL + `/health`
   - Set monitoring interval to 5 minutes

2. **Cron Jobs**:
   - Set up a cron job to ping your `/health` endpoint every 5 minutes

## 🔌 API Endpoints

The application provides a RESTful API:

- `GET /api/bots` - Get all bots and statistics
- `POST /api/bots` - Add a new bot
- `PUT /api/bots/:id/toggle` - Toggle bot status
- `DELETE /api/bots/:id` - Remove a bot
- `GET /health` - Health check endpoint

## 📂 Project Structure

```
discord-stay-online/
├── server.js              # Main Express server
├── botManager.js          # Bot management logic
├── public/               # Web UI files
│   ├── index.html       # Main HTML file
│   ├── style.css        # Styling
│   └── script.js        # Frontend JavaScript
├── package.json         # Dependencies
└── README.md           # This file
```

## ⚠️ Important Notes

- **Terms of Service**: Using self-bots violates Discord's Terms of Service. Use at your own risk.
- **Rate Limiting**: Be mindful of Discord's rate limits when using multiple tokens
- **Security**: Never share your Discord tokens publicly
- **Educational Purpose**: This project is for educational purposes only

## 🛠️ Technical Details

- **Backend**: Node.js, Express.js, Socket.IO
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Discord API**: Eris library
- **Real-time Updates**: WebSocket communication

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🔗 Links

- [Original Project](https://github.com/Gunthersuper/Discord-Online-Forever)
- [Discord Developer Portal](https://discord.com/developers/applications)
- [Replit](https://replit.com)
- [UptimeRobot](https://uptimerobot.com)

---

**Made with ❤️ for educational purposes**
