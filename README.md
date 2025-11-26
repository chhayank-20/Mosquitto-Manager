# Mosquitto Broker Manager

A powerful, Dockerized Mosquitto MQTT broker with a modern web-based management interface. Easily configure listeners, manage security (TLS/SSL), handle users and ACLs, and monitor your broker in real-time.

![Mosquitto Manager UI](https://placehold.co/800x400?text=Mosquitto+Manager+Dashboard)

## 🚀 Features

*   **Multi-Protocol Support**: Configure and manage **MQTT**, **MQTTS** (TLS), **WebSockets** (WS), and **Secure WebSockets** (WSS) listeners.
*   **Advanced Security**:
    *   **Certificate Management**: Generate self-signed certificates for development/testing with a single click.
    *   **Upload/Download**: Easily upload your own CA, Server Certificates, and Keys via the UI.
    *   **Auth Control**: Toggle anonymous access, require client certificates, and manage password files.
*   **User & Access Control**:
    *   Create and manage users with securely hashed passwords (`mosquitto_passwd`).
    *   Define Access Control Lists (ACLs) to restrict user access to specific topics.
*   **Real-time Monitoring**:
    *   **Live Stats**: Monitor broker uptime, load, memory usage, and network traffic in real-time.
    *   **Client Tracking**: See who is connected, their IP, and client ID.
    *   **Live Logs**: Stream Mosquitto logs directly to your browser to debug issues instantly.
*   **Dockerized**: Fully containerized solution based on Alpine Linux for a lightweight footprint.

## 🛠️ Prerequisites

*   [Docker](https://www.docker.com/)
*   [Docker Compose](https://docs.docker.com/compose/)

## 🏁 Getting Started

1.  **Clone the repository** (if applicable) or navigate to the project directory.

2.  **Start the container**:
    ```bash
    docker-compose up -d --build
    ```

3.  **Access the Dashboard**:
    Open your browser and navigate to `http://localhost:3000`.

    *   **Web UI**: Port `3000`
    *   **Default MQTT**: Port `1883`
    *   **Default MQTTS**: Port `8883` (if configured)

## 📖 Usage Guide

### Managing Listeners
Navigate to the **Listeners** tab to add or configure broker listeners.
*   **Protocol**: Choose between MQTT, MQTTS, WS, or WSS.
*   **Security**: For MQTTS/WSS, you can generate test certificates or upload your own.
*   **Ports**: Ensure any new ports you define are also exposed in your `docker-compose.yml` if you need external access.

### Security & TLS
To enable SSL/TLS:
1.  Create a listener with protocol **MQTTS** or **WSS**.
2.  Click **"Generate Test Certs"** to automatically create and configure self-signed certificates.
3.  Alternatively, upload your `ca.crt`, `server.crt`, and `server.key` using the upload buttons.
4.  Click **"Save & Apply"** to restart the broker with the new settings.

### Users & ACLs
*   **Users**: Create users in the "Users" tab. Passwords are automatically hashed.
*   **ACLs**: Define profiles (e.g., "Sensors", "Admins") with read/write patterns and assign them to listeners or users.

### Logs
View real-time logs in the **Logs** tab. You can toggle between "Live" streaming and viewing the historical log buffer.

## 🏗️ Architecture

*   **Broker**: [Eclipse Mosquitto](https://mosquitto.org/) (running on Alpine Linux)
*   **Backend**: Node.js + Express + Socket.io (Manages config, streams logs/stats)
*   **Frontend**: React + Vite + Tailwind CSS + Lucide Icons (User Interface)
*   **Persistence**: Configuration (`mosquitto.conf`, `state.json`) and data are persisted in the `./mymosquitto` volume.

## 📂 Directory Structure

```
.
├── app
│   ├── backend     # Node.js Management API
│   └── frontend    # React UI
├── mymosquitto     # Persistent storage (Configs, Certs, Data, Logs)
├── Dockerfile      # Multi-stage build for Backend, Frontend, and Mosquitto
├── docker-compose.yml
└── entrypoint.sh   # Startup script managing Node and Mosquitto processes
```

## 🔧 Configuration

### Environment Variables
*   `PORT`: Web UI port (default: `3000`)
*   `MOSQUITTO_DIR`: Configuration directory (default: `/mymosquitto`)
*   `DATA_DIR`: App state directory (default: `/app/data`)

### Volumes
*   `./mymosquitto:/mymosquitto`: Persists Mosquitto configuration, certificates, and logs.

## 🤝 Contributing
Feel free to submit issues and enhancement requests.

## 📄 License
[MIT](LICENSE)
