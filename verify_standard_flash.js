const https = require('https');

const apiKey = 'AIzaSyAAj4SGLSFRrEqPknJYXkuy6f7T6bpYSWE';
const data = JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] });

const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (d) => body += d);
    res.on('end', () => {
        console.log('STATUS:', res.statusCode);
        console.log('BODY:', body);
    });
});

req.write(data);
req.end();
