import http from 'http';
import https from 'https';

const PORT = process.env.PORT || 3000;

// Propriul Piped (din env) + fallback la instanțe publice
const OWN_PIPED = process.env.PIPED_API;

const PIPED_INSTANCES = [
  ...(OWN_PIPED ? [OWN_PIPED] : []),
  'pipedapi.kavin.rocks',
  'pipedapi.leptons.xyz',
  'pipedapi.nosebs.ru',
  'pipedapi-libre.kavin.rocks',
  'piped-api.privacy.com.de',
  'pipedapi.adminforge.de',
  'api.piped.yt',
  'pipedapi.drgns.space',
  'pipedapi.owo.si',
  'pipedapi.ducks.party',
  'piped-api.codespace.cz',
  'pipedapi.reallyaweso.me',
  'api.piped.private.coffee',
  'pipedapi.darkness.services',
  'pipedapi.orangenet.cc'
];

console.log('🚀 Starting server...');
console.log(`📌 PORT: ${PORT}`);
console.log(`📌 PIPED instances: ${PIPED_INSTANCES.length}`);

function httpGet(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function getAudioUrl(videoId) {
  for (const instance of PIPED_INSTANCES) {
    try {
      const apiUrl = `https://${instance}/streams/${videoId}`;
      console.log(`   📡 Trying: ${instance}`);
      
      const response = await httpGet(apiUrl);
      
      if (response.statusCode !== 200) {
        console.log(`   ❌ Status: ${response.statusCode}`);
        continue;
      }
      
      const info = JSON.parse(response.data);
      
      if (info.error) {
        console.log(`   ❌ API error: ${info.error}`);
        continue;
      }
      
      if (!info.audioStreams?.length) {
        console.log(`   ❌ No audio streams`);
        continue;
      }
      
      info.audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      let url = info.audioStreams[0].url;
      
      if (url.startsWith('://')) url = 'https' + url;
      
      console.log(`   ✅ Found via ${instance}`);
      return url;
    } catch (e) {
      console.log(`   ❌ ${instance}: ${e.message}`);
      continue;
    }
  }
  
  console.log(`   ❌ All instances failed`);
  return null;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
  const videoId = reqUrl.searchParams.get('v');
  
  if (reqUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }

  if (!videoId) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <h1>🎵 YouTube Audio API</h1>
      <p>Usage: <code>/watch?v=VIDEO_ID</code></p>
      <p>Example: <a href="/watch?v=dQw4w9WgXcQ">/watch?v=dQw4w9WgXcQ</a></p>
      <p><a href="/health">/health</a> - Health check</p>
      <p>Piped instances: ${PIPED_INSTANCES.length}</p>
    `);
    return;
  }
  
  console.log(`\n🔍 Request: ${videoId}`);
  
  const url = await getAudioUrl(videoId);
  
  if (!url) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Video not found or no audio available');
    return;
  }
  
  console.log(`✅ Redirecting to audio stream\n`);
  
  res.writeHead(302, { 'Location': url });
  res.end();
});

server.listen(PORT, () => {
  console.log(`\n🎵 YouTube Audio URL API`);
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🔧 Piped instances: ${PIPED_INSTANCES.length}`);
  console.log(`\nExample: http://localhost:${PORT}/watch?v=dQw4w9WgXcQ\n`);
});
