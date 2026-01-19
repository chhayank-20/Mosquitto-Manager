const http = require('http');
const net = require('net');

const API_HOST = 'localhost';
const API_PORT = 3000;
const MQTT_PORT = 1883;

// 1. Login to get Cookie
function login() {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            username: process.env.WEB_USERNAME || 'admin',
            password: process.env.WEB_PASSWORD || 'admin'
        });

        const req = http.request({
            hostname: API_HOST,
            port: API_PORT,
            path: '/api/auth/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            if (res.statusCode === 200) {
                const cookies = res.headers['set-cookie'];
                resolve(cookies);
            } else {
                reject(new Error(`Login failed with status ${res.statusCode}`));
            }
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// 2. Get State from API
function getApiState(cookies) {
    return new Promise((resolve, reject) => {
        const req = http.get({
            hostname: API_HOST,
            port: API_PORT,
            path: '/api/state',
            headers: {
                'Cookie': cookies
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) throw new Error(`API returned ${res.statusCode}`);
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
    });
}

// 2. Check Port Connectivity
function checkPort(port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2000);

        socket.on('connect', () => {
            socket.destroy();
            resolve(true); // Connected
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });

        socket.on('error', (err) => {
            socket.destroy();
            resolve(false);
        });

        socket.connect(port, 'localhost');
    });
}

async function run() {
    console.log('--- Verifying Broker Setup ---');

    console.log(`1. Authenticating with default credentials...`);
    let cookies;
    try {
        cookies = await login();
        console.log('   Login successful.');
    } catch (e) {
        console.error('   Login failed. Ensure backend is running and default admin creds work.');
        return;
    }

    console.log(`2. Fetching API State from http://${API_HOST}:${API_PORT}...`);
    try {
        const state = await getApiState(cookies);
        if (!state || !state.listeners) throw new Error('Invalid state received');

        const l1883 = state.listeners.find(l => l.port === 1883);
        if (!l1883) {
            console.log('   [WARN] Listener on 1883 not found in config.');
        } else {
            console.log(`   State says Port 1883 is: ${l1883.enabled ? 'ENABLED' : 'DISABLED'}`);
        }

        console.log('2. Testing actual TCP connection to Port 1883...');
        const isOpen = await checkPort(1883);
        console.log(`   Port 1883 is: ${isOpen ? 'OPEN (Accepting Connections)' : 'CLOSED (Refused/Timeout)'}`);

        console.log('--- Analysis ---');
        if (l1883 && !l1883.enabled && isOpen) {
            console.error('❌ DISCREPANCY DETECTED!');
            console.error('   The API says Port 1883 should be DISABLED, but it is effectively OPEN.');
            console.error('   Possible Causes:');
            console.error('   1. You verified "Save Draft" but forgot to click "Apply Config".');
            console.error('   2. The container started with default config (Enabled) and hasn\'t reloaded.');
            console.error('   -> ACTION: Go to Settings -> Listeners, click "Apply Config".');
        } else if (l1883 && l1883.enabled && !isOpen) {
            console.error('❌ DISCREPANCY DETECTED!');
            console.error('   The API says Port 1883 should be ENABLED, but it is CLOSED.');
            console.error('   -> ACTION: Check Docker logs for startup errors.');
        } else {
            console.log('✅ Configuration matches Reality.');
        }

    } catch (e) {
        console.error('Failed to run verification:', e.message);
    }
}

run();
