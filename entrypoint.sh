#!/bin/sh
set -e

# Ensure folders exist
mkdir -p /mymosquitto/data /mymosquitto/log /mymosquitto/acls /mymosquitto/certs/web

# Ensure passwordfile exists in SOURCE
if [ ! -f /mymosquitto/passwordfile ]; then
    echo "Creating empty passwordfile..."
    touch /mymosquitto/passwordfile
fi

# Pre-seed SECURE config to prevents crash on start if config points to it
SECURE_DIR="/etc/mosquitto/secure"
mkdir -p "$SECURE_DIR/acls"

# Copy if exists, otherwise touch
if [ -f /mymosquitto/passwordfile ]; then
    cp /mymosquitto/passwordfile "$SECURE_DIR/passwordfile"
else
    touch "$SECURE_DIR/passwordfile"
fi

# Copy ACLs
if [ -d /mymosquitto/acls ]; then
    cp -r /mymosquitto/acls/* "$SECURE_DIR/acls/" 2>/dev/null || true
fi

# Fix permissions for secure dir (Mosquitto uid 100)
# Fix permissions for secure dir (Mosquitto uid 100)
chown -R 100:101 "$SECURE_DIR"
chmod -R 0700 "$SECURE_DIR"

# Fix permissions for log file
if [ -f /mymosquitto/mosquitto.log ]; then
    chown 100:101 /mymosquitto/mosquitto.log
    chmod 0644 /mymosquitto/mosquitto.log
fi

# Ensure data dir is writable by Mosquitto
chown -R 100:101 /mymosquitto/data
chmod -R 0700 /mymosquitto/data

# If no config yet, create a minimal default so mosquitto can start
if [ ! -f /mymosquitto/mosquitto.conf ]; then
  echo "Creating default mosquitto.conf..."
  cat <<EOF >/mymosquitto/mosquitto.conf
persistence true
persistence_location /mymosquitto/data/
log_dest file /mymosquitto/mosquitto.log
log_dest stdout
listener 1883 0.0.0.0
allow_anonymous true
EOF
fi

# Function to handle shutdown
cleanup() {
    echo "Container stopping, killing processes..."
    kill $MOSQ_PID 2>/dev/null || true
    kill $NODE_PID 2>/dev/null || true
    exit 0
}

trap cleanup TERM INT

# Start Node backend in background
echo "Starting Node backend..."
cd /app/backend
node dist/server.js &
NODE_PID=$!

# Loop to keep Mosquitto running
while true; do
    echo "Starting Mosquitto..."
    mosquitto -c /mymosquitto/mosquitto.conf &
    MOSQ_PID=$!
    echo $MOSQ_PID >/run/mosquitto.pid
    
    # Wait for Mosquitto to exit
    wait $MOSQ_PID
    EXIT_CODE=$?
    
    echo "Mosquitto exited with code $EXIT_CODE."
    
    # If Node is also dead, exit container
    if ! kill -0 $NODE_PID 2>/dev/null; then
        echo "Node backend is dead. Exiting container."
        exit 1
    fi
    
    echo "Restarting Mosquitto in 1 second..."
    sleep 1
done
