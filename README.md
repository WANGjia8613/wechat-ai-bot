# 微信 AI Bot（Ubuntu 一键部署）

开箱即用的微信 AI 聊天机器人，附带网页控制台。基于 **Wechaty** + OpenAI 兼容大模型接口。

## 特性

- **双模式**：模拟模式开箱即用（无需微信账号），真实模式扫码登录
- **AI 自动回复**：支持 DeepSeek / 通义千问 / OpenAI 等任何 OpenAI 兼容接口
- **网页控制台**：扫码登录、联系人列表、聊天界面、配置管理、运行日志
- **双登录驱动**：wechat4u 网页协议（免费）、padlocal ipad 协议（稳定，需 token）

## 快速开始

```bash
cd /path/to/project
./start.sh
```

前端面板：http://localhost:5173 （如部署在预览环境，使用平台提供的预览链接）
后端 API：http://localhost:3001

### 配置 AI（可选）

编辑 `backend/.env`（参考 `backend/.env.example`）：

```env
USER_LLM_API_KEY=你的API Key
USER_LLM_BASE_URL=https://api.deepseek.com/v1
USER_LLM_MODEL=deepseek-chat
```

DeepSeek 示例：

```bash
cd backend
cp .env.example .env
# 编辑 .env，填入你的 API Key
```

未配置 API Key 时，机器人会返回"未配置"提示消息，不影响其它功能。

## 微信登录模式

控制台右上角/配置面板可切换模式：

| 模式 | 说明 | 要求 |
|------|------|------|
| 模拟模式（默认） | 内置演示联系人，直接体验 AI 对话 | 无 |
| 真实微信 | 微信扫码登录，自动回复好友和 @ 群消息 | 微信账号 |

真实模式说明：

- **wechat4u（免费）**：使用网页协议，启动后弹二维码扫码。免费但可能被微信风控，适合小号测试。
- **padlocal（稳定）**：ipad 协议。在配置面板选择 padlocal 并填入 token，token 在 [pad-local.com](https://pad-local.com) 购买。

群聊：仅在机器人被 @ 时回复；私聊：收到即自动回复。

## 项目结构

```
├── backend/            # Node.js 后端
│   ├── src/
│   │   ├── index.js    # Express API + WebSocket
│   │   ├── bot.js      # Wechaty 机器人管理（真实/模拟双驱动）
│   │   ├── ai.js       # OpenAI 兼容大模型客户端
│   │   └── config.js   # 配置读取
│   └── .env.example    # 环境变量模板
├── frontend/           # Vue3 + Vite 控制台
│   └── src/
│       ├── App.vue
│       └── components/ # 联系人、聊天、配置面板
└── start.sh            # 一键启动脚本
```

## API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/bot/status` | 机器人状态 |
| POST | `/api/bot/start` | 启动机器人 |
| POST | `/api/bot/stop` | 停止机器人 |
| POST | `/api/bot/restart` | 重启机器人 |
| POST | `/api/bot/send` | 发送消息 |
| POST | `/api/bot/mock-inject` | 模拟模式注入消息 |
| GET | `/api/contacts` | 联系人列表 |
| POST | `/api/chat` | 直接调用 AI（测试） |
| GET/PUT | `/api/config` | 读写配置 |
| WS | `/ws` | 实时推送（状态/二维码/消息/日志） |

## 生产部署（Ubuntu 服务器）

### 1. 服务器安装 Node.js 20+

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # 应显示 v20.x 或更高
```

### 2. 上传代码到服务器

本机打包（排除依赖，服务器上重新安装）：

```bash
tar --exclude=node_modules --exclude=dist --exclude=.env -czf wechat-ai-bot.tar.gz backend frontend start.sh README.md
scp wechat-ai-bot.tar.gz user@your-server:/opt/
```

服务器上解压：

```bash
sudo mkdir -p /opt && cd /opt
sudo tar -xzf wechat-ai-bot.tar.gz
sudo chown -R $USER:$USER /opt/backend /opt/frontend
```

> 方式 A（git clone）不需要 chown，clone 已属于当前用户。

如果项目在 git 仓库，也可直接：

```bash
cd /opt && git clone https://github.com/WANGjia8613/wechat-ai-bot
```

**注意两种方式目录不同**：

- 方式 A（git clone）：代码在 `/opt/wechat-ai-bot/`，下文路径为 `/opt/wechat-ai-bot/backend`
- 方式 B（tar 解压）：代码在 `/opt/` 根，下文路径为 `/opt/backend`

### 3. 安装依赖并构建

以下按方式 A（git clone）示例；方式 B 把 `/opt/wechat-ai-bot` 换成 `/opt` 即可：

```bash
cd /opt/wechat-ai-bot/backend
npm install
cp .env.example .env
nano .env          # 填入 USER_LLM_API_KEY、WECHAT_MODE 等
cd /opt/wechat-ai-bot/frontend
npm install
npm run build      # 生成生产产物 dist/
```

### 4. pm2 守护进程（长期运行）

```bash
sudo npm install -g pm2
cd /opt/wechat-ai-bot/backend
pm2 start src/index.js --name wechat-ai-bot
pm2 save
pm2 startup       # 按提示执行输出的命令，开机自启
```

### 5. 访问

生产模式下后端单端口同时托管前端页面 + API + WebSocket：

```
http://你的服务器IP:3001
```

需要开放防火墙端口：

```bash
sudo ufw allow 3001/tcp
```

### 6. （可选）Nginx 反向代理 + HTTPS

```bash
sudo apt-get install -y nginx
sudo nano /etc/nginx/sites-available/wechat-ai-bot
```

```nginx
server {
    listen 80;
    server_name bot.example.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/wechat-ai-bot /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

HTTPS 可搭配 certbot：`sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d bot.example.com`

## 常见问题

**Q: 网页协议登录不了？**
微信近年收紧网页版登录，新号容易被风控。可用稳定模式 padlocal（需付费 token）。

**Q: 如何改自动回复前缀？**
控制台"AI 对话"面板设置"回复前缀"，或配置 `backend/.env` 中的 `REPLY_PREFIX`。

**Q: 如何部署到服务器长期运行？**
推荐使用 `pm2`：

```bash
npm install -g pm2
pm2 start backend/src/index.js --name wechat-ai-bot
pm2 save && pm2 startup
```

## 免责声明

本工具基于第三方开源协议（Wechaty）开发，仅供学习与技术研究使用。请遵守微信用户协议，勿用于营销、骚扰等场景，违规使用导致账号受限的风险由使用者自行承担。
