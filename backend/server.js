const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/photos', express.static(path.join(__dirname, 'uploads')));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, uploadDir); },
  filename: (req, file, cb) => {
    const uniqueName = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } });

app.post('/upload', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ success: true, filename: req.file.filename, url: `/photos/${req.file.filename}` });
});

app.get('/api/photos', (req, res) => {
  if (!fs.existsSync(uploadDir)) return res.json({ photos: [] });
  const files = fs.readdirSync(uploadDir)
    .filter(file => file.endsWith('.jpg'))
    .map(file => {
      const stats = fs.statSync(path.join(uploadDir, file));
      return { name: file, url: `/photos/${file}`, size: Math.round(stats.size / 1024), timestamp: stats.mtime };
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json({ photos: files });
});

app.get('/', (req, res) => {
  const html = `<!DOCTYPE html><html><head><title>CCTV Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; background: #9bbc0f; color: #0f380f; padding: 20px; }
    .header { background: #0f380f; color: #9bbc0f; padding: 20px; text-align: center; border: 4px solid #306230; margin-bottom: 20px; font-size: 24px; font-weight: bold; }
    .stats { background: #8bac0f; border: 4px solid #0f380f; padding: 15px; margin-bottom: 20px; display: flex; justify-content: space-around; flex-wrap: wrap; gap: 10px; }
    .stat-box { text-align: center; padding: 10px; }
    .stat-number { font-size: 32px; font-weight: bold; color: #0f380f; }
    .photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; margin-top: 20px; }
    .photo-card { background: #8bac0f; border: 4px solid #0f380f; padding: 10px; text-align: center; }
    .photo-card img { width: 100%; height: 200px; object-fit: cover; border: 2px solid #0f380f; }
    .photo-info { margin-top: 10px; font-size: 14px; word-break: break-all; }
    .btn { background: #0f380f; color: #9bbc0f; border: 2px solid #306230; padding: 10px 20px; cursor: pointer; font-family: 'Courier New', monospace; font-weight: bold; margin-top: 10px; display: inline-block; text-decoration: none; }
    .btn:hover { background: #306230; }
    .refresh-btn { position: fixed; bottom: 20px; right: 20px; font-size: 18px; padding: 15px 25px; border-radius: 50%; width: 60px; height: 60px; }
  </style></head><body>
    <div class="header">📷 CCTV DASHBOARD <br><small>Nokia Style Monitor</small></div>
    <div class="stats">
      <div class="stat-box"><div class="stat-number" id="totalPhotos">0</div><div>Total Photos</div></div>
      <div class="stat-box"><div class="stat-number" id="lastUpdate">--</div><div>Last Update</div></div>
    </div>
    <div class="photo-grid" id="photoGrid"></div>
    <button class="btn refresh-btn" onclick="loadPhotos()">🔄</button>
    <script>
      function loadPhotos() {
        fetch('/api/photos').then(r => r.json()).then(data => {
          document.getElementById('totalPhotos').textContent = data.photos.length;
          document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
          const grid = document.getElementById('photoGrid');
          grid.innerHTML = '';
          data.photos.forEach(photo => {
            const card = document.createElement('div');
            card.className = 'photo-card';
            card.innerHTML = '<img src="' + photo.url + '" alt="' + photo.name + '"><div class="photo-info">' + photo.name + '<br>' + photo.size + ' KB</div><a href="' + photo.url + '" class="btn" download> DOWNLOAD</a>';
            grid.appendChild(card);
          });
        });
      }
      loadPhotos();
      setInterval(loadPhotos, 30000);
    </script>
  </body></html>`;
  res.send(html);
});

app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
