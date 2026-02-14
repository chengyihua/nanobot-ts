# QQ Official Robot Setup Guide (HTTPS Version)

Since QQ requires HTTPS for webhooks, and your server (`bot.acbnlink.com`) already has Nginx with SSL configured, the best approach is to use Nginx as a reverse proxy.

## Method 1: Use Nginx Reverse Proxy (Recommended)

This method uses your existing domain and SSL certificate.

### 1. Server-Side Configuration (Nginx)
SSH into your server (`8.134.58.5`) and edit your Nginx configuration file (usually in `/etc/nginx/sites-available/` or `/etc/nginx/nginx.conf`).

Add this location block inside your `server { listen 443 ssl; ... }` block:

```nginx
location /qq-official-webhook {
    # Forward traffic to the local port where frps is listening for TCP connections
    # Note: This assumes frpc is configured to forward to remotePort 18080
    proxy_pass http://127.0.0.1:18080;
    
    # Standard proxy headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

After saving, reload Nginx: `sudo nginx -s reload`

### 2. Local Configuration (frpc.toml)
Edit `/Users/chengyihua/frp/frpc.toml` on your local machine:

```toml
serverAddr = "8.134.58.5"
serverPort = 7000

[[proxies]]
name = "nanobot-gateway-tcp"
type = "tcp"
localIP = "127.0.0.1"
localPort = 8080
remotePort = 18080  # Must match the port in Nginx config
```

### 3. Restart FRP
```bash
pkill frpc
/Users/chengyihua/frp/frpc -c /Users/chengyihua/frp/frpc.toml
```

### 4. Update QQ Bot Console
Set Callback URL to: `https://bot.acbnlink.com/qq-official-webhook`

---

## Method 2: Quick Test with LocalTunnel (No Server Config)

If you cannot edit Nginx config right now, use this temporary URL.

1.  **URL**: `https://eighty-shrimps-visit.loca.lt/qq-official-webhook`
2.  **Status**: Running now (I started it for you)
3.  **Note**: This URL changes every time you restart the tool.

## Troubleshooting

- **502 Bad Gateway**: Means Nginx cannot connect to frp (check if frpc is running and ports match).
- **404 Not Found**: 
  - If from Nginx: Location block missing or path wrong.
  - If from Express (Nanobot): Webhook path mismatch (check config.json).
