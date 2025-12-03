import http from 'http';
import https from 'https';

const PORT = 3001;

const PIPED_INSTANCES = [
  // 'http://localhost:8081',
  'piped.local',
  'pipedapi.local',
  'pipedproxy.local'
];

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;
    
    console.log(`   📡 GET ${url}`);
    
    client.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (res) => {
      console.log(`   📥 Status: ${res.statusCode}`);
      
      if (res.statusCode === 301 || res.statusCode === 302) {
        console.log(`   🔄 Redirect: ${res.headers.location}`);
        httpGet(res.headers.location).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`   📦 Data length: ${data.length} bytes`);
        resolve({ statusCode: res.statusCode, data });
      });
    }).on('error', (e) => {
      console.log(`   ❌ Error: ${e.message}`);
      reject(e);
    });
  });
}

async function getAudioStreamUrl(videoId) {
  console.log(`\n🔍 getAudioStreamUrl("${videoId}")`);
  
  for (const instance of PIPED_INSTANCES) {
    try {
      const apiUrl = instance.startsWith('http') 
        ? `${instance}/streams/${videoId}` 
        : `https://${instance}/streams/${videoId}`;
      
      console.log(`\n📡 Trying: ${apiUrl}`);
      const response = await httpGet(apiUrl);
      
      if (response.statusCode !== 200) {
        console.log(`   ❌ Bad status: ${response.statusCode}`);
        continue;
      }
      
      const info = JSON.parse(response.data);
      console.log(`   📋 Title: ${info.title || 'N/A'}`);
      console.log(`   🎵 Audio streams: ${info.audioStreams?.length || 0}`);
      
      if (info.error) {
        console.log(`   ❌ API Error: ${info.error}`);
        continue;
      }
      
      const audioFormats = info.audioStreams || [];
      if (audioFormats.length === 0) {
        console.log(`   ❌ No audio streams found`);
        continue;
      }
      
      audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      console.log(`   ✅ Best audio: ${audioFormats[0].bitrate} bps`);
      
      return {
        url: audioFormats[0].url,
        title: info.title,
        author: info.uploader,
        duration: info.duration,
        mimeType: audioFormats[0].mimeType || 'audio/webm'
      };
    } catch (e) {
      console.log(`   ❌ Exception: ${e.message}`);
      continue;
    }
  }
  
  console.log(`\n❌ All instances failed`);
  return null;
}

function proxyStream(audioUrl, req, res) {
  const urlObj = new URL(audioUrl);
  
  const options = {
    hostname: urlObj.hostname,
    path: urlObj.pathname + urlObj.search,
    headers: {
      'User-Agent': 'Mozilla/5.0',
      ...(req.headers.range ? { 'Range': req.headers.range } : {})
    }
  };
  
  https.get(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      'Content-Type': proxyRes.headers['content-type'] || 'audio/webm',
      'Content-Length': proxyRes.headers['content-length'],
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      ...(proxyRes.headers['content-range'] ? { 'Content-Range': proxyRes.headers['content-range'] } : {})
    });
    proxyRes.pipe(res);
  }).on('error', (e) => {
    res.writeHead(500);
    res.end('Stream error');
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  // Pagina principală cu player
  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>🎵 YouTube Audio Streamer</title>
  <style>
    * { box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #eee;
      min-height: 100vh;
      margin: 0;
      padding: 40px 20px;
    }
    .container { max-width: 600px; margin: 0 auto; }
    h1 { text-align: center; margin-bottom: 30px; }
    .input-group { display: flex; gap: 10px; margin-bottom: 20px; }
    input { 
      flex: 1; padding: 15px; border: none; border-radius: 8px;
      background: rgba(255,255,255,0.1); color: #fff; font-size: 16px;
    }
    input::placeholder { color: rgba(255,255,255,0.5); }
    button { 
      padding: 15px 30px; border: none; border-radius: 8px;
      background: #e94560; color: #fff; font-weight: bold;
      cursor: pointer; font-size: 16px;
    }
    button:hover { background: #ff6b6b; }
    .player { 
      background: rgba(255,255,255,0.05); 
      padding: 30px; border-radius: 16px; 
      text-align: center;
    }
    .title { font-size: 18px; margin-bottom: 5px; }
    .author { color: #888; margin-bottom: 20px; }
    audio { width: 100%; margin-top: 20px; }
    .status { margin-top: 15px; color: #888; font-size: 14px; }
    .url-box { 
      margin-top: 20px; padding: 15px; background: rgba(0,0,0,0.3); 
      border-radius: 8px; word-break: break-all; font-size: 12px;
      font-family: monospace; text-align: left; max-height: 100px;
      overflow-y: auto;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎵 YouTube Audio Streamer</h1>
    <div class="input-group">
      <input type="text" id="videoId" placeholder="YouTube Video ID (ex: dQw4w9WgXcQ)" value="dQw4w9WgXcQ">
      <button onclick="loadAudio()">▶ Play</button>
    </div>
    <div class="player" id="player" style="display:none;">
      <div class="title" id="title"></div>
      <div class="author" id="author"></div>
      <audio id="audio" controls autoplay></audio>
      <div class="status" id="status"></div>
      <div class="url-box" id="audioUrl"></div>
      <button onclick="window.open(document.getElementById('audioUrl').textContent, '_blank')" style="margin-top:10px;">🔗 Deschide URL</button>
    </div>
  </div>
  <script>
    async function loadAudio() {
      const videoId = document.getElementById('videoId').value.trim();
      if (!videoId) return alert('Introdu un Video ID!');
      
      const player = document.getElementById('player');
      const audio = document.getElementById('audio');
      const status = document.getElementById('status');
      
      player.style.display = 'block';
      status.textContent = '⏳ Se încarcă...';
      
      try {
        const res = await fetch('/info/' + videoId);
        const info = await res.json();
        
        if (info.error) {
          status.textContent = '❌ ' + info.error;
          return;
        }
        
        document.getElementById('title').textContent = info.title;
        document.getElementById('author').textContent = info.author;
        document.getElementById('audioUrl').textContent = info.url;
        audio.src = info.url;
        status.textContent = '🎧 Streaming...';
        
        audio.onplay = () => status.textContent = '🎧 Playing...';
        audio.onpause = () => status.textContent = '⏸️ Paused';
        audio.onerror = () => status.textContent = '❌ Eroare la stream';
      } catch (e) {
        status.textContent = '❌ Eroare: ' + e.message;
      }
    }
  </script>
</body>
</html>
    `);
    return;
  }
  
  // API: info despre video
  if (url.pathname.startsWith('/info/')) {
    const videoId = url.pathname.split('/')[2];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    
    const info = await getAudioStreamUrl(videoId);
    if (!info) {
      res.end(JSON.stringify({ error: 'Nu am putut obține stream-ul audio' }));
      return;
    }
    
    info.url = info.url.replace('pipedproxy.local', 'localhost:8082');
    if (info.url.startsWith('://')) {
      info.url = 'http' + info.url;
    }
    console.log(`📎 URL: ${info.url}`);
    
    res.end(JSON.stringify(info));
    return;
  }
  
  // Stream audio proxy
  if (url.pathname.startsWith('/stream/')) {
    const videoId = url.pathname.split('/')[2];
    const info = await getAudioStreamUrl(videoId);
    
    if (!info) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    
    info.url = info.url.replace('pipedproxy.local', 'localhost:8082');
    console.log(info.url);
    
    proxyStream(info.url, req, res);
    return;
  }
  
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n🎵 YouTube Audio Streamer`);
  console.log(`\n📡 Server pornit: http://localhost:${PORT}`);
  console.log(`\n💡 Deschide linkul în browser pentru a asculta audio streaming!`);
});
