# QQ Official Robot Setup Guide

## 1. Prerequisites
- A registered QQ Bot on [QQ Open Platform](https://q.qq.com/)
- `AppID`, `Token`, and `AppSecret`
- A public IP or domain (for Webhook mode)

## 2. Configuration
Edit `.nanobot/config.json`:
```json
{
  "channels": {
    "qq_official": {
      "enabled": true,
      "appid": "YOUR_APP_ID",
      "token": "YOUR_TOKEN",
      "secret": "YOUR_SECRET",
      "sandbox": true,
      "intents": ["GUILDS", "GUILD_MESSAGES", "DIRECT_MESSAGE", "C2C_MESSAGE_CREATE"],
      "webhook": {
        "enabled": true,
        "port": 8080,
        "path": "/qq-official-webhook"
      }
    }
  }
}
```

## 3. Network Setup (Webhook Mode)
Since QQ requires a public URL to push messages to your bot, you need to expose your local port `8080`.

### Recommended: Use FRP (TCP Mode)
TCP mode is more reliable as it avoids HTTP/HTTPS protocol mismatches and vhost configuration issues.

1.  **Edit `frpc.toml`**:
    ```toml
    serverAddr = "YOUR_SERVER_IP"
    serverPort = 7000

    [[proxies]]
    name = "nanobot-gateway"
    type = "tcp"
    localIP = "127.0.0.1"
    localPort = 8080
    remotePort = 18080  # Choose an open port on your server
    ```

2.  **Restart FRP**:
    ```bash
    # Kill existing process
    pkill frpc
    # Start new process
    ./frpc -c frpc.toml
    ```

3.  **Update QQ Bot Console**:
    - Callback URL: `http://YOUR_SERVER_DOMAIN:18080/qq-official-webhook`
    - **Note**: Ensure your server's firewall allows traffic on port `18080`.

## 4. Verification
1.  Start Nanobot: `npm run dev gateway`
2.  Check logs for: `✅ QQ Official channel attached to Gateway`
3.  Click "Verify" in QQ Bot Console.

## 5. Troubleshooting
- **404 Not Found**: Check if you are hitting the correct port. Use `curl http://localhost:8080/qq-official-webhook` locally to verify the gateway is running.
- **Connection Refused**: Check if `frpc` is running and connected.
- **SSL Error**: Ensure you are using `http://` if your server does not have SSL configured for that port.
