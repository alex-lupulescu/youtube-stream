import http from 'http';

const PORT = 3002;
const PIPED_API = [
  // 'http://localhost:8081',
  'piped.local',
  'pipedapi.local',
  'pipedproxy.local'
];

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function getAudioUrl(videoId) {
  const response = await httpGet(`${PIPED_API}/streams/${videoId}`);
  if (response.statusCode !== 200) return null;
  
  const info = JSON.parse(response.data);
  if (!info.audioStreams?.length) return null;
  
  info.audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
  let url = info.audioStreams[0].url;
  
  // url = url.replace('pipedproxy.local', 'localhost:8082');
  if (url.startsWith('://')) url = 'http' + url;
  
  return url;
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
  const videoId = reqUrl.searchParams.get('v');
  
  if (!videoId) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Usage: http://localhost:3002/watch?v=VIDEO_ID');
    return;
  }
  
  console.log(`🔍 Request: ${videoId}`);
  
  const url = await getAudioUrl(videoId);
  
  if (!url) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }
  
  console.log(`✅ URL: ${url.substring(0, 80)}...`);
  
  res.writeHead(302, { 'Location': url });
  res.end();
});

server.listen(PORT, () => {
  console.log(`\n🎵 YouTube Audio URL API`);
  console.log(`\n📡 http://localhost:${PORT}/watch?v=VIDEO_ID`);
  console.log(`\nExemplu: http://localhost:${PORT}/watch?v=dQw4w9WgXcQ`);
});
