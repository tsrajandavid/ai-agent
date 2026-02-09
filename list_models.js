const https = require('https');

const apiKey = 'AIzaSyAAj4SGLSFRrEqPknJYXkuy6f7T6bpYSWE';

const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models?key=${apiKey}`,
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (d) => body += d);
    res.on('end', () => {
        if (res.statusCode === 200) {
            const data = JSON.parse(body);
            console.log('--- AVAILABLE MODELS ---');
            data.models.forEach(m => {
                if (m.name.includes('flash')) {
                    console.log(`NAME: ${m.name} | SUPPORTED: ${m.supportedGenerationMethods.join(', ')}`);
                }
            });
        } else {
            console.log('FAILED:', res.statusCode, body);
        }
    });
});

req.on('error', (e) => console.error(e));
req.end();
