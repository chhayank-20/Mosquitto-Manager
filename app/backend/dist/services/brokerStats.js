"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrokerStatsService = void 0;
const mqtt_1 = __importDefault(require("mqtt"));
class BrokerStatsService {
    constructor(onStatsUpdate) {
        this.client = null;
        this.stats = {
            uptime: 0,
            clientsTotal: 0,
            clientsActive: 0,
            messagesSent: 0,
            messagesReceived: 0,
            loadMessagesReceived1min: 0,
            loadMessagesSent1min: 0,
            bytesReceived: 0,
            bytesSent: 0,
        };
        this.mqttUrl = 'mqtt://127.0.0.1:10883';
        this.onStatsUpdate = onStatsUpdate;
    }
    start() {
        // Connect to local broker
        // We assume the backend is in the same network/container as mosquitto
        this.client = mqtt_1.default.connect(this.mqttUrl, {
            clientId: 'backend-stats-monitor',
            // If auth is enabled, we might need credentials. 
            // For now, we assume we can connect (maybe via a special listener or localhost exception).
            // If localhost listener allows anonymous, this works.
        });
        this.client.on('connect', () => {
            console.log('Stats service connected to MQTT broker');
            this.client?.subscribe('$SYS/#');
        });
        this.client.on('message', (topic, message) => {
            const value = message.toString();
            this.updateStat(topic, value);
        });
        this.client.on('error', (err) => {
            console.error('Stats service MQTT error:', err);
        });
    }
    updateStat(topic, value) {
        // $SYS/broker/uptime
        // $SYS/broker/clients/total
        // $SYS/broker/clients/active
        // $SYS/broker/messages/sent
        // $SYS/broker/messages/received
        // $SYS/broker/load/messages/received/1min
        // $SYS/broker/load/messages/sent/1min
        // $SYS/broker/bytes/received
        // $SYS/broker/bytes/sent
        let changed = false;
        const num = parseFloat(value);
        if (isNaN(num))
            return;
        if (topic.endsWith('/uptime')) {
            this.stats.uptime = num;
            changed = true;
        }
        else if (topic.endsWith('/clients/total')) {
            this.stats.clientsTotal = num;
            changed = true;
        }
        else if (topic.endsWith('/clients/active')) {
            this.stats.clientsActive = num;
            changed = true;
        }
        else if (topic.endsWith('/messages/sent')) {
            this.stats.messagesSent = num;
            changed = true;
        }
        else if (topic.endsWith('/messages/received')) {
            this.stats.messagesReceived = num;
            changed = true;
        }
        else if (topic.endsWith('/load/messages/received/1min')) {
            this.stats.loadMessagesReceived1min = num;
            changed = true;
        }
        else if (topic.endsWith('/load/messages/sent/1min')) {
            this.stats.loadMessagesSent1min = num;
            changed = true;
        }
        else if (topic.endsWith('/bytes/received')) {
            this.stats.bytesReceived = num;
            changed = true;
        }
        else if (topic.endsWith('/bytes/sent')) {
            this.stats.bytesSent = num;
            changed = true;
        }
        if (changed) {
            // Debounce updates if needed, but for now emit on every change (or throttle in UI)
            this.onStatsUpdate(this.stats);
        }
    }
}
exports.BrokerStatsService = BrokerStatsService;
