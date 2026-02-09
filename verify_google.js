const OpenAI = require('openai');
const https = require('https');

async function main() {
    const apiKey = 'AIzaSyAAj4SGLSFRrEqPknJYXkuy6f7T6bpYSWE';
    const client = new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    });

    console.log('--- TEST 1: OpenAI SDK with gemini-1.5-flash-8b ---');
    try {
        const response = await client.chat.completions.create({
            model: 'gemini-1.5-flash-8b',
            messages: [{ role: 'user', content: 'Hello' }],
        });
        console.log('SUCCESS (8b):', response.choices[0].message.content);
        return;
    } catch (error) {
        console.error('FAILED (8b):', error.status || error.message);
    }

    console.log('\n--- TEST 2: OpenAI SDK with gemini-1.5-flash ---');
    try {
        const response = await client.chat.completions.create({
            model: 'gemini-1.5-flash',
            messages: [{ role: 'user', content: 'Hello' }],
        });
        console.log('SUCCESS (Standard):', response.choices[0].message.content);
        return;
    } catch (error) {
        console.error('FAILED (Standard):', error.status || error.message);
    }

    console.log('\n--- TEST 3: Native REST API (No SDK) ---');
    // Test native Google API directly to rule out SDK issues
    const data = JSON.stringify({
        contents: [{ parts: [{ text: "Hello" }] }]
    });

    const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };

    const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (d) => body += d);
        res.on('end', () => {
            if (res.statusCode === 200) {
                console.log('SUCCESS (Native REST):', JSON.parse(body).candidates[0].content.parts[0].text);
            } else {
                console.log('FAILED (Native REST):', res.statusCode, body);
            }
        });
    });

    req.on('error', (error) => {
        console.error('FAILED (Native REST):', error);
    });

    req.write(data);
    req.end();
}

main();
