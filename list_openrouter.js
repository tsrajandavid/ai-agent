const https = require('https');

// NOTE: Ideally we would use the user's key, but we can't easily access VS Code secrets here.
// However, OpenRouter's /models endpoint is public! We don't need a key to list models.
const options = {
    hostname: 'openrouter.ai',
    path: '/api/v1/models',
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (d) => body += d);
    res.on('end', () => {
        if (res.statusCode === 200) {
            const data = JSON.parse(body);
            console.log('--- OPENROUTER FREE MODELS ---');
            data.data.forEach(m => {
                // Check if it's free or has 'free' in ID
                // OpenRouter pricing: m.pricing.prompt === '0'
                const isFree = m.pricing && m.pricing.prompt === '0' && m.pricing.completion === '0';
                if (isFree || m.id.includes(':free')) {
                    console.log(`ID: ${m.id} | NAME: ${m.name}`);
                }
            });
        } else {
            console.log('FAILED:', res.statusCode, body);
        }
    });
});

req.on('error', (e) => console.error(e));
req.end();
