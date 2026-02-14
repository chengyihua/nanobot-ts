# QQ 机器人 HTTPS 配置指南 (针对 bot.acbnlink.com)

由于 QQ 机器人强制要求 HTTPS 回调，而您的 frp 目前主要配置了 HTTP 代理，导致 QQ 的 HTTPS 请求无法正确转发到本地。

微信机器人之所以能用，是因为它可能允许 HTTP 回调，或者您的服务器已经处理了相关转发。

要让 QQ 机器人使用您的自定义域名 `https://bot.acbnlink.com`，您需要在 **云服务器 (8.134.58.5)** 的 Nginx 配置中添加以下内容。

## 1. 修改 Nginx 配置

找到您的 Nginx 配置文件 (通常在 `/etc/nginx/sites-enabled/` 下，或者宝塔面板的网站设置中)，在监听 443 端口的 `server` 块中添加：

```nginx
server {
    listen 443 ssl;
    server_name bot.acbnlink.com;

    # SSL 证书配置 (您现有的配置)
    ssl_certificate ...;
    ssl_certificate_key ...;

    # --- 添加这一段 ---
    location /qq-official-webhook {
        # 转发到本地 frps 监听的 HTTP 端口 (假设 frps 的 vhost_http_port 是 8080)
        # 如果您的 frpc.toml 中 wecom-bot 也是用的 8080，这里应该是指向 frps 绑定的 HTTP 端口
        # 注意：这里 proxy_pass 的端口必须是 frps 服务器端监听 http 流量的端口
        # 如果 frps.ini 中 vhost_http_port = 8080，则填 8080
        proxy_pass http://127.0.0.1:8080; 
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    # ----------------
}
```

**关键点：** `proxy_pass` 必须指向服务器上 `frps` 监听 HTTP 请求的端口（通常在 `frps.ini` 中配置为 `vhost_http_port`）。

## 2. 临时替代方案 (已为您启动)

为了让您立刻能通过测试，我为您启动了一个临时的 HTTPS 隧道。

请在 QQ 机器人后台填入以下地址：

**回调地址:** `https://old-onions-sniff.loca.lt/qq-official-webhook`

这个地址会直接穿透到您的本地，绕过服务器的 Nginx 配置问题。
