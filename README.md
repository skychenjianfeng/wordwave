# 🌊 WordWave 词浪

百词斩风格的英语背单词网站，主打**发音、语速调节与音节切分**，附自动播放引擎、
DeepSeek AI 例句、SM-2 间隔重复、测验与统计；现已升级为**多词库 + 商业化后端**：
前端 Vite + React + TypeScript，后端 Django REST Framework，数据层 MySQL + Redis，
Docker Compose 一键部署。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Vite 5 · React 18 · TypeScript(strict) · Tailwind CSS · zustand · recharts · TanStack Virtual |
| 后端 | Django 5 · Django REST Framework · SimpleJWT（注册/登录） |
| 数据 | MySQL 8（业务数据/词库/进度/笔记/例句缓存） · Redis 7（热点缓存/例句一级缓存） |
| AI | DeepSeek 例句代理（密钥仅存于 `server/.env`，Django 从环境变量读取） |
| 部署 | Docker Compose（mysql + redis + wordwave 三服务，`restart: unless-stopped`） |

## 一键启动（开发模式）

```bash
npm install                 # 安装前端依赖
npm run setup:backend       # 创建 backend/.venv 并安装 Django 依赖（首次）
npm run db:up               # 启动 MySQL(13307) / Redis(16380) 容器
npm run migrate             # 初始化数据库表（首次）
npm run seed:dicts          # 导入 26 个词库到 MySQL（首次）
npm run dev                 # 同时拉起 Django(8010) 与 Vite(5173)
```

访问 <http://localhost:5173>。也可以直接双击根目录 `start-dev.cmd`
（自动装依赖、起数据库容器、拉前后端、5 秒后打开浏览器）。

## 生产部署（Docker 全栈）

```bash
npm install
docker-compose up -d --build
```

- 访问：<http://localhost:3101>（前端静态资源与 API 均由 Django 容器提供）
- 容器：`wordwave-mysql`(13306→容器内) / `wordwave-redis`(16380→容器内) / `wordwave`(3101→8000)
- 启动时自动执行 `migrate → seed_dicts → import_legacy（旧 Express 数据迁移）→ gunicorn`
- 数据持久化：`wordwave-mysql-data`（MySQL）、`wordwave-redis-data`（Redis）、
  `wordwave-data`（旧版 JSON 进度，供一次性迁移）、`wordwave-speech-cache`（本地 Piper 语音缓存）
- 常用命令：`docker-compose logs -f wordwave` / `docker-compose down` / `docker-compose up -d`

> Windows 提示：Docker Desktop 下如果 `docker-compose` 不在 PATH，先执行
> `$env:PATH = 'C:\Program Files\Docker\Docker\resources\bin;' + $env:PATH`。
> 若提示 `dockerDesktopLinuxEngine` 管道不存在，说明 Docker Desktop 后端未启动：
> 以管理员身份启动 `com.docker.service`（或重启 Docker Desktop / 系统）后再
> `docker-compose up -d --build`。

## 词库（26 个，共 77,368 词）

| 类别 | 词库 |
| --- | --- |
| 考试词库 | 考研英语（词频 5530，内置）· 初中 · 高考 · CET4 · CET6 · 专四(TEM-4) · 专八(TEM-8) · 托福 · 雅思 · GRE · GMAT · SAT · 商务英语(BEC) |
| 专业领域 | IT 通用 · 人工智能/机器学习 · AI for Science · Linux 命令 · SQL · Python · Java · JavaScript · Go · 地质学 |
| 专有名词 | 世界各国（250 国/地区，含首都与大洲）· 世界地理（大洲/海洋/河流/山脉/湖泊/沙漠等）· 英语人名（常用名与姓氏） |

- 数据源：内置 `NETEMVocabulary`（考研 5530）、`KyleBing/english-vocabulary`、
  `ranbeioc/typing-word`、`dr5hn/countries-states-cities-database`（均为开源许可数据）。
- 前端静态资源位于 `public/data/dicts/*.json`（离线可用），MySQL 中同步一份用于
  服务端搜索/分页（`GET /api/dicts`、`GET /api/dicts/<id>/words?page=&q=&category=`）。
- 音标：来源词库自带 IPA；考研词库由内置 `ipa-dict` 生成（`public/data/ipa-en-us.json`）。
- 重新拉取/转换词库：`npm run fetch:dicts`（GitHub + jsDelivr 双源，自动去重转换）。

## 功能一览

### 发音 · 语速 · 音节（全程离线，无任何在线发音）
- 单词/音节/中文释义使用本地预生成音包（美式 `public/audio/`、英式伦敦腔 `public/audio/uk/`）；
- AI 例句等动态英文文本由 **Django 内置的开源 Piper 神经语音引擎**（rhasspy/piper-tts，
  模型随仓库分发于 `backend/models/piper/`，含美式 en_US 与英式 en_GB 两套本地模型）
  在本地服务端合成，不调用任何在线语音服务；服务端不可用时浏览器端 Piper WASM 兜底，
  仍完全离线。中文释义朗读使用设备本地系统语音（离线），不访问网络。
- 全局语速 0.5x~2.0x（滑块/档位/快捷键 +/−），单词、逐音节、中文释义、AI 例句全部联动，
  实时生效并持久化；自动播放配置面板与单词卡片上均可调。
- `hyphen` 包按发音规则切分音节（important → im·por·tant），卡片中点展示，
  每音节/整词可手写联想笔记并持久化。

### 自动播放引擎
- 播放顺序：词频 / 随机 / 生词 / 错词 / 分类 / 词频区间；本次数量 20/50/100/自定义。
- 单词发音重复 1~10 遍（播放中可调）、单词间隔 0~10s、进度条与跳转；
  播放过的单词自动记为“已学”。
- **AI 例句并行预取**：单词一进入当前位即请求例句，读完发音直接朗读，不等网络。
- 自动播放配置含**集中开关区**（全部持久化）：
  1. 朗读中文释义（默认开）
  2. AI 例句总开关（默认关；关闭后零 API 调用）
  3. 例句包含中文翻译（默认开；AI 例句关闭时置灰禁用）
  4. 逐音节朗读（默认开）
  5. 显示中文释义卡片（默认开）
- 例句风格：考研真题风 / 日常简单风 / 搞笑幽默风 / 商务职场风 / 故事叙述风（可切换并持久化）。

### DeepSeek 例句代理
- `POST /api/example`（Django），请求 `{word, meaning, withTranslation, style}`；
  `withTranslation=true` 返回英文例句+中文翻译+近义词辨析；`false` 只返回英文、零中文。
- 缓存 key 含「单词 + 翻译维度 + 风格」：Redis 一级 + MySQL 二级，切换开关/风格不重复请求；
  支持重新生成与清空缓存（前端设置中心/自动播放页）。
- 失败优雅降级：提示一次后自动跳过，不中断自动播放。

### 学习与复习
- 卡片学习（正=单词+音节+音标，反=释义），“认识/不认识”；SM-2 间隔重复、今日复习队列；
  错词本自动收集、单独学习与导出；三种测验（看英文选释义/听音辨词/拼写默写）；
  统计面板（已学/掌握/错词/streak/近 30 天柱状图/分类雷达图）。
- 单词列表：搜索、分类/子分类/掌握状态筛选、虚拟滚动（5530+ 不卡）。

### 个人学习中心（新增）
- 统计卡：已学 / 已掌握 / 错词 / 今日待复习 / 今日已学 / 连续天数；
- 近 70 天打卡热力图、最近 14 天学习记录、每日目标滑块（登录后同步到云端）；
- 词库概览与当前词库进度条；一键同步进度。

### 设置中心（新增）
- 外观（深浅主题）、发音（语速/口音，全部本地 Piper）、播放（例句风格 + 集中开关区）；
- 词典管理：26 个词库列表与默认词库切换（学习/复习/测验/自动播放全局生效）；
- 账号资料：昵称/简介/每日目标/修改密码/退出登录（JWT）；
- 数据与缓存：JSON 导出/导入备份、本地与云端例句缓存清空。

### 账号与同步
- Django 注册/登录（SimpleJWT 30 天令牌；旧 Express scrypt 密码哈希自动兼容并升级）；
- 登录后学习进度自动上传（2 秒防抖），登录时拉取云端覆盖；游客模式仅存本机。
- 密码使用 Django PBKDF2；Django Admin 位于 `/admin/`（生产请务必修改 `DJANGO_SECRET_KEY`）。

## 目录结构

```text
.
├─ backend/                     # Django 后端
│  ├─ wordwave/                 # 项目配置（settings/urls/wsgi）
│  ├─ api/                      # 模型/视图/DeepSeek 代理/TTS/种子命令
│  │  └─ management/commands/   # seed_dicts、import_legacy
│  ├─ requirements.txt
│  └─ run-dev.ps1
├─ public/data/dicts/           # 26 个词库静态 JSON + index.json（离线可用）
├─ scripts/
│  ├─ fetch-dicts.mjs           # 词库下载/转换（GitHub + jsDelivr）
│  └─ e2e-verify.mjs            # Puppeteer 端到端验收（59 项）
├─ server/
│  ├─ .env                      # DeepSeek 密钥（已 gitignore，禁止提交）
│  ├─ .env.example
│  ├─ .env.django               # Django/MySQL/Redis 配置（已 gitignore）
│  └─ .env.django.example
├─ docker-compose.yml           # mysql + redis + wordwave
├─ Dockerfile                   # 前端构建 → Django 运行（whitenoise 托管 dist）
└─ vite.config.ts               # /api 代理到 Django 8010
```

## DeepSeek 配置

`server/.env`（已按需求创建，含真实密钥，**被 `.gitignore` 与 `.dockerignore` 双重排除**）：

```env
DEEPSEEK_API_KEY=sk-xxxx
DEEPSEEK_MODEL=deepseek-v4-flash
```

`server/.env.django`（不含密钥；`server/.env.django.example` 为模板）：

```env
DJANGO_SECRET_KEY=...
DJANGO_DEBUG=true
MYSQL_DATABASE=wordwave
MYSQL_USER=wordwave
MYSQL_PASSWORD=wordwave_dev_password
MYSQL_HOST=localhost
MYSQL_PORT=13307
REDIS_HOST=localhost
REDIS_PORT=16380
```

## 本地 Piper 说明

- 发音引擎为开源 **rhasspy/piper-tts**，模型随仓库分发（`backend/models/piper/`，
  美式 `en_US-lessac-medium` + 英式 `en_GB-cori-medium`），后端 `GET /api/speech`
  完全本地合成，前端不访问任何在线语音服务。
- 中文释义朗读使用设备本地系统语音（离线）；服务端 Piper 不可用时前端自动回退
  浏览器 Piper WASM（离线）或系统语音，功能不中断。
- 个别 Windows 本地开发环境（非 Docker）若遇到 piper-tts 的 espeak-ng 数据路径
  报错，属该第三方包的 Windows wheel 打包问题，请以 Docker 部署为准；开发态会
  自动回退到浏览器 WASM 发音，不影响使用。

## 快捷键

空格=播放/翻面 · ←/→=上一个/下一个 · 1/2=认识/不认识 · +/-=语速增减

## 商业化路线（已就绪/建议）

- 已就绪：JWT 认证、RBAC 预留（Django auth 用户组）、CORS 白名单配置、Redis 缓存、
  数据备份（JSON 导出 + MySQL 卷）、Docker 持久化、旧数据迁移、密钥环境变量注入。
- 建议下一步：HTTPS/反向代理（Nginx/Caddy）、支付与订阅（会员解锁更多词库）、
  邮箱/短信验证与找回密码、Celery 异步生成大规模 TTS/例句、管理后台（Django Admin 已内置）、
  MySQL 主从与 Redis 哨兵、监控告警（Sentry/Prometheus）、用户协议与隐私合规。
