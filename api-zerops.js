import http from 'http';
import https from 'https';

const PORT = process.env.PORT || 3002;
const PIPED_API = process.env.PIPED_API || 'https://pipedapi.kavin.rocks';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function getAudioUrl(videoId) {
  try {
    const apiUrl = PIPED_API.startsWith('http') 
      ? `${PIPED_API}/streams/${videoId}`
      : `https://${PIPED_API}/streams/${videoId}`;
    
    console.log(`📡 Fetching: ${apiUrl}`);
    const response = await httpGet(apiUrl);
    
    if (response.statusCode !== 200) {
      console.log(`❌ Status: ${response.statusCode}`);
      return null;
    }
    
    const info = JSON.parse(response.data);
    if (!info.audioStreams?.length) {
      console.log(`❌ No audio streams`);
      return null;
    }
    
    info.audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    let url = info.audioStreams[0].url;
    
    if (url.startsWith('://')) url = 'https' + url;
    
    return url;
  } catch (e) {
    console.log(`❌ Error: ${e.message}`);
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
  const videoId = reqUrl.searchParams.get('v');
  
  if (!videoId) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <h1>🎵 YouTube Audio API</h1>
      <p>Usage: <code>/watch?v=VIDEO_ID</code></p>
      <p>Example: <a href="/watch?v=dQw4w9WgXcQ">/watch?v=dQw4w9WgXcQ</a></p>
    `);
    return;
  }
  
  console.log(`🔍 Request: ${videoId}`);
  
  const url = await getAudioUrl(videoId);
  
  if (!url) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Video not found or no audio available');
    return;
  }
  
  console.log(`✅ Redirecting to audio stream`);
  
  res.writeHead(302, { 'Location': url });
  res.end();
});

server.listen(PORT, () => {
  console.log(`\n🎵 YouTube Audio URL API`);
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🔧 PIPED_API: ${PIPED_API}`);
  console.log(`\nExample: http://localhost:${PORT}/watch?v=dQw4w9WgXcQ`);
});

