"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCerts = void 0;
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const CERT_DIR = '/mymosquitto/certs';
const generateCerts = () => {
    if (!fs_1.default.existsSync(CERT_DIR)) {
        fs_1.default.mkdirSync(CERT_DIR, { recursive: true });
    }
    const caKey = path_1.default.join(CERT_DIR, 'ca.key');
    const caCrt = path_1.default.join(CERT_DIR, 'ca.crt');
    const serverKey = path_1.default.join(CERT_DIR, 'server.key');
    const serverCsr = path_1.default.join(CERT_DIR, 'server.csr');
    const serverCrt = path_1.default.join(CERT_DIR, 'server.crt');
    const clientKey = path_1.default.join(CERT_DIR, 'client.key');
    const clientCsr = path_1.default.join(CERT_DIR, 'client.csr');
    const clientCrt = path_1.default.join(CERT_DIR, 'client.crt');
    try {
        // 1. Generate CA
        if (!fs_1.default.existsSync(caKey) || !fs_1.default.existsSync(caCrt)) {
            console.log('Generating CA...');
            (0, child_process_1.execSync)(`openssl req -new -x509 -days 3650 -extensions v3_ca -keyout ${caKey} -out ${caCrt} -nodes -subj "/CN=Mosquitto CA"`);
        }
        // 2. Generate Server Cert
        console.log('Generating Server Cert...');
        (0, child_process_1.execSync)(`openssl genrsa -out ${serverKey} 2048`);
        (0, child_process_1.execSync)(`openssl req -new -key ${serverKey} -out ${serverCsr} -subj "/CN=localhost"`);
        (0, child_process_1.execSync)(`openssl x509 -req -in ${serverCsr} -CA ${caCrt} -CAkey ${caKey} -CAcreateserial -out ${serverCrt} -days 3650`);
        // 3. Generate Client Cert (for testing)
        console.log('Generating Client Cert...');
        (0, child_process_1.execSync)(`openssl genrsa -out ${clientKey} 2048`);
        (0, child_process_1.execSync)(`openssl req -new -key ${clientKey} -out ${clientCsr} -subj "/CN=client"`);
        (0, child_process_1.execSync)(`openssl x509 -req -in ${clientCsr} -CA ${caCrt} -CAkey ${caKey} -CAcreateserial -out ${clientCrt} -days 3650`);
        // Cleanup CSRs
        if (fs_1.default.existsSync(serverCsr))
            fs_1.default.unlinkSync(serverCsr);
        if (fs_1.default.existsSync(clientCsr))
            fs_1.default.unlinkSync(clientCsr);
        return { success: true, paths: { ca: caCrt, serverCert: serverCrt, serverKey: serverKey } };
    }
    catch (e) {
        console.error('Cert generation failed:', e);
        throw e;
    }
};
exports.generateCerts = generateCerts;
