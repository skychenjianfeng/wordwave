# WordWave iPad 安装指南（免费方案）

不需要 Mac、不需要 Apple 开发者账号，用「云端构建 + Sideloadly 免费签名」即可装到自己 iPad 上试用。

> 说明：免费签名有效期 7 天，到期后把 iPad 连回电脑重新装一次即可，学习进度保存在本机不会丢。

## 第一步：云端构建未签名 ipa

### 方式 A：GitHub Actions（推荐）

1. 在 GitHub 新建一个仓库（公开即可，macOS 构建免费），例如 `wordwave`
2. 在项目目录执行（把仓库地址换成你自己的）：

```bash
git remote add origin https://github.com/你的用户名/wordwave.git
git push -u origin master
```

3. 打开 GitHub 仓库 → **Actions** → 左侧 **iOS Build** → **Run workflow**
4. 等 10~20 分钟，构建完成后在 Actions 页面下载 artifact：
   `wordwave-ios-unsigned.ipa`

### 方式 B：Codemagic（备用）

1. 同样先把代码推到 GitHub
2. 登录 [codemagic.io](https://codemagic.io)，用 GitHub 登录并授权仓库
3. 项目根目录已包含 `codemagic.yaml`，选择该 workflow 构建
4. 下载构建产物 `wordwave-ios-unsigned.ipa`

> 云端构建时语音模型会自动从 HuggingFace 下载（约 320MB），模型不占用你的仓库空间。

## 第二步：用 Sideloadly 免费签名安装（Windows）

1. 到 [sideloadly.io](https://sideloadly.io/) 下载并安装 Windows 版
2. 用 USB 把 iPad 连到电脑，iPad 上点「信任此电脑」
3. **iPad 开启开发者模式**（iOS 16+）：设置 → 隐私与安全性 → 开发者模式 → 打开并重启
4. 打开 Sideloadly：
   - 选择设备：你的 iPad
   - 拖入 `wordwave-ios-unsigned.ipa`
   - 填你的 **Apple ID 和密码**（免费 Apple ID 即可，不需要开发者账号）
   - 点 **Start**，等待签名安装完成
5. iPad 上：设置 → 通用 → VPN 与设备管理 → 找到你的 Apple ID → 点「信任」
6. 回到桌面打开 WordWave

## 第三步：让 App 连上电脑后端（可选）

- 发音（单词/音节/中文释义）**完全离线**，不配置也能用
- AI 例句、服务器音频需要连电脑后端：App 内「我的 → 设置 → 服务器地址」填
  `http://192.168.1.100:3101`（把 IP 换成你电脑的局域网 IP），并确保电脑上 Docker 后端在运行

## 常见问题

| 问题 | 解决办法 |
|---|---|
| 安装后打不开/闪退 | 检查是否已在「VPN 与设备管理」里信任证书 |
| 7 天后打不开 | 重新连电脑用 Sideloadly 再装一次（免费签名过期） |
| 免费账号装不了 | 免费 Apple ID 同时最多装 3 个自签 App，删掉不用的再试 |
| 构建失败 | 把 GitHub Actions 日志发给我 |
| 想长期上架 | 注册自己的 Apple 开发者账号（$99/年），不需要租别人的 |
