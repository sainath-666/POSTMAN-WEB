/**
 * Angular Dev Server Proxy — CORS bypass for Swagger spec fetching.
 *
 * Routes /swagger-proxy?url=<encoded_url> → the actual external URL,
 * forwarding the response back to the Angular app without CORS issues.
 */
const https = require('https');
const http = require('http');
const { URL } = require('url');

function setupProxy(app) {
  app.get('/swagger-proxy', (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
      res.status(400).json({ error: 'Missing "url" query parameter' });
      return;
    }

    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch {
      res.status(400).json({ error: 'Invalid URL' });
      return;
    }

    const client = parsed.protocol === 'https:' ? https : http;

    const proxyReq = client.get(targetUrl, {
      headers: {
        'Accept': 'application/json, text/html, */*',
        'User-Agent': 'SmartAPITester/1.0',
      },
      timeout: 15000,
    }, (proxyRes) => {
      // Follow redirects (301, 302, 307, 308)
      if ([301, 302, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
        let redirectUrl = proxyRes.headers.location;
        if (!redirectUrl.startsWith('http')) {
          redirectUrl = parsed.origin + (redirectUrl.startsWith('/') ? '' : '/') + redirectUrl;
        }
        // Redirect the client to fetch the new URL through proxy again
        res.redirect(`/swagger-proxy?url=${encodeURIComponent(redirectUrl)}`);
        return;
      }

      let data = '';
      proxyRes.on('data', (chunk) => { data += chunk; });
      proxyRes.on('end', () => {
        // Set CORS headers so the Angular app can read the response
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Content-Type', proxyRes.headers['content-type'] || 'application/json');
        res.status(proxyRes.statusCode).send(data);
      });
    });

    proxyReq.on('error', (err) => {
      res.status(502).json({ error: `Proxy error: ${err.message}` });
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      res.status(504).json({ error: 'Request timed out' });
    });
  });
}

module.exports = setupProxy;
