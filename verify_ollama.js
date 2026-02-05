const http = require('http');

const data = JSON.stringify({
    model: 'qwen2.5-coder:3b',
    prompt: 'Hello, are you there?',
    stream: false
});

const options = {
    hostname: 'localhost',
    port: 11434,
    path: '/api/generate',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

console.log("Testing connection to Ollama...");

const req = http.request(options, (res) => {
    let responseData = '';

    console.log(`Status Code: ${res.statusCode}`);

    res.on('data', (chunk) => {
        responseData += chunk;
    });

    res.on('end', () => {
        if (res.statusCode === 200) {
            const json = JSON.parse(responseData);
            console.log("Success! Response from Qwen:");
            console.log("------------------------");
            console.log(json.response);
            console.log("------------------------");
        } else {
            console.error("Error: Ollama returned status", res.statusCode);
            console.error(responseData);
        }
    });
});

req.on('error', (error) => {
    console.error("Connection Failed:", error.message);
    console.error("Make sure Ollama is running (try 'ollama serve' in a terminal)");
});

req.write(data);
req.end();
