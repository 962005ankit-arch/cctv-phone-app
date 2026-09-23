const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// In-Memory Buffer (Last 30 seconds of frames)
// 2 FPS * 30 seconds = 60 frames max. Har frame ~50KB = Total 3MB RAM (Safe for Render)
let frameBuffer = []; 
let lastHeartbeat = Date.now();
const DEVICE_NAME = "Vivo I2208 (CCTV)";

// 1. Frame Upload Endpoint (Phone se aayega)
app.post('/upload', (req, res) => {
  const { frame, timestamp } = req.body;
  
  if (frame) {
    // Buffer me frame add karo
    frameBuffer.push({ time: Date.now(), data: frame });
    
    // Agar buffer 30 seconds se bada ho jaye, purane frames delete karo
    const cutoff = Date.now() - 30000; 
    frameBuffer = frameBuffer.filter(f => f.time > cutoff);
  }
  res.json({ success: true });
});

// 2. Heartbeat Endpoint (Phone batayega ki wo zinda hai)
app.post('/heartbeat', (req, res) => {
  lastHeartbeat = Date.now();
  res.json({ success: true });
});

// 3. Status Endpoint (Dashboard check karega)
app.get('/api/status', (req, res) => {
  const isOnline = (Date.now() - lastHeartbeat) < 20000; // 20 sec tak ping na aaye to offline
  res.json({ 
    online: isOnline, 
    deviceName: DEVICE_NAME,
    lastPing: lastHeartbeat 
  });
});

// 4. Live Stream Endpoint (10 Second Delay ke sath)
app.get('/api/stream', (req, res) => {
  const delaySec = parseInt(req.query.delay) || 10; // Default 10 sec delay
  const targetTime = Date.now() - (delaySec * 1000);
  
  // Buffer me se wo frame dhundo jo 10 second purana hai
  const targetFrame = frameBuffer.find(f => f.time <= targetTime) || frameBuffer[0];
  
  if (targetFrame) {
    // Frame ko base64 se image me convert karke bhejo
    const imgBuffer = Buffer.from(targetFrame.data, 'base64');
    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Content-Length': imgBuffer.length,
      'Cache-Control': 'no-cache'
    });
    res.end(imgBuffer);
  } else {
    res.status(404).send('No frames available');
  }
});

// Dashboard HTML
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Live CCTV Feed</title>
      <style>
        body { background: #111; color: #0f0; font-family: monospace; text-align: center; padding: 20px; }
        .header { display: flex; justify-content: space-between; align-items: center; background: #222; padding: 15px; border-radius: 10px; margin-bottom: 20px; }
        .status-dot { height: 15px; width: 15px; border-radius: 50%; display: inline-block; margin-right: 10px; }
        .online { background: #0f0; box-shadow: 0 0 10px #0f0; }
        .offline { background: #f00; box-shadow: 0 0 10px #f00; }
        .feed-container { border: 2px solid #0f0; padding: 10px; display: inline-block; border-radius: 10px; }
        img { max-width: 100%; height: auto; border-radius: 5px; }
        .info { margin-top: 10px; font-size: 14px; color: #888; }
      </style>
    </head>
    <body>
      <div class="header">
        <div><strong>Device:</strong> <span id="deviceName">Loading...</span></div>
        <div><span id="statusDot" class="status-dot offline"></span> <span id="statusText">Checking...</span></div>
      </div>
      
      <div class="feed-container">
        <h2>🔴 LIVE FEED (10s Delay)</h2>
        <img id="liveFeed" src="/api/stream?delay=10" alt="Live Feed" />
        <div class="info">Buffer Delay: 10 Seconds | Refresh: 500ms</div>
      </div>

      <script>
        // Feed ko har 500ms me refresh karo (2 FPS)
        setInterval(() => {
          const img = document.getElementById('liveFeed');
          img.src = '/api/stream?delay=10&t=' + new Date().getTime();
        }, 500);

        // Status check karo har 5 second me
        function checkStatus() {
          fetch('/api/status').then(r => r.json()).then(data => {
            document.getElementById('deviceName').innerText = data.deviceName;
            const dot = document.getElementById('statusDot');
            const text = document.getElementById('statusText');
            if (data.online) {
              dot.className = 'status-dot online';
              text.innerText = 'ONLINE';
              text.style.color = '#0f0';
            } else {
              dot.className = 'status-dot offline';
              text.innerText = 'OFFLINE';
              text.style.color = '#f00';
            }
          });
        }
        checkStatus();
        setInterval(checkStatus, 5000);
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
