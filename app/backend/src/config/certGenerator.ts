import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CERT_DIR = '/mymosquitto/certs';

export const generateCerts = () => {
    if (!fs.existsSync(CERT_DIR)) {
        fs.mkdirSync(CERT_DIR, { recursive: true });
    }

    const caKey = path.join(CERT_DIR, 'ca.key');
    const caCrt = path.join(CERT_DIR, 'ca.crt');
    const serverKey = path.join(CERT_DIR, 'server.key');
    const serverCsr = path.join(CERT_DIR, 'server.csr');
    const serverCrt = path.join(CERT_DIR, 'server.crt');
    const clientKey = path.join(CERT_DIR, 'client.key');
    const clientCsr = path.join(CERT_DIR, 'client.csr');
    const clientCrt = path.join(CERT_DIR, 'client.crt');

    try {
        // 1. Generate CA
        if (!fs.existsSync(caKey) || !fs.existsSync(caCrt)) {
            console.log('Generating CA...');
            execSync(`openssl req -new -x509 -days 3650 -extensions v3_ca -keyout ${caKey} -out ${caCrt} -nodes -subj "/CN=Mosquitto CA"`);
        }

        // 2. Generate Server Cert
        console.log('Generating Server Cert...');
        execSync(`openssl genrsa -out ${serverKey} 2048`);
        execSync(`openssl req -new -key ${serverKey} -out ${serverCsr} -subj "/CN=localhost"`);
        execSync(`openssl x509 -req -in ${serverCsr} -CA ${caCrt} -CAkey ${caKey} -CAcreateserial -out ${serverCrt} -days 3650`);

        // 3. Generate Client Cert (for testing)
        console.log('Generating Client Cert...');
        execSync(`openssl genrsa -out ${clientKey} 2048`);
        execSync(`openssl req -new -key ${clientKey} -out ${clientCsr} -subj "/CN=client"`);
        execSync(`openssl x509 -req -in ${clientCsr} -CA ${caCrt} -CAkey ${caKey} -CAcreateserial -out ${clientCrt} -days 3650`);

        // Cleanup CSRs
        if (fs.existsSync(serverCsr)) fs.unlinkSync(serverCsr);
        if (fs.existsSync(clientCsr)) fs.unlinkSync(clientCsr);

        return { success: true, paths: { ca: caCrt, serverCert: serverCrt, serverKey: serverKey } };
    } catch (e: any) {
        console.error('Cert generation failed:', e);
        throw e;
    }
};
