# IPTV Source Aggregator

一个整合来自 iPTV 项目的电视频道源，并通过 GitHub Actions 自动更新的 IPTV 源列表工具。

## 简介

这个项目是一个简便的 IPTV 源整合工具，从 iPTV 项目中提取多个电视频道源，生成可直接订阅到 IPTV 播放器（TVBOX、VLC、PotPlayer 等）的多格式源列表文件。

## 主要功能

- **自动抓取**：从 iPTV 项目中抓取多个电视频道源文件
- **源分类**：对所有频道进行分类，方便管理和查找
- **多格式输出**：生成 M3U、TXT 和 JSON 等格式的播放列表
- **GitHub Actions 自动化**：定时自动抓取和更新源列表
- **订阅友好**：生成的 M3U 文件可直接订阅到任何 IPTV 播放器

## 文件结构

```
IPTV Source Aggregator/
├── config/
│   └── sources.json              # 源配置
├── scripts/                      # 核心脚本
│   └── generate-playlist.mjs    # 源抓取和播放列表生成脚本
├── output/                       # 输出目录
│   ├── iptv-aggregated.m3u        # M3U 格式播放列表
│   ├── iptv-aggregated.txt       # TXT 格式播放列表
│   └── channels.json            # JSON 格式频道索引
├── .github/                      # GitHub Actions 配置
│   └── workflows/                # GitHub Actions 工作流
│       └── generate-playlist.yml  # 自动运行脚本的配置
├── .gitignore                   # Git 忽略文件
└── package.json                 # Node.js 依赖
└── README.md                     # 本 README 文件
```

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/YOUR_USERNAME/iptv-source-aggregator.git
```

### 2. 安装依赖

```bash
npm install
```

### 3. 运行生成脚本

```bash
node scripts/generate-playlist.mjs
```

生成后，脚本会在 `output/` 目录下创建三个文件：

- `iptv-aggregated.m3u` - 用于 IPTV 播放器的 M3U 格式文件
- `iptv-aggregated.txt` - 纯文本格式的频道列表
- `channels.json` - JSON 格式的频道索引文件

### 4. 通过 GitHub Actions 自动化

本项目通过 GitHub Actions 实现自动更新，你需要:

1. **Fork 本仓库** 到你的 GitHub 账号
2. **填写 GitHub Personal Access Token** 到 Secrets 中

在 `.github/workflows/generate-playlist.yml` 中有完整的配置，你可以在定时任务中自定义抓取频率。

## 发布订阅 URL

### M3U 格式订阅 URL

通过 GitHub Pages 发布后，你可以直接使用以下订阅 URL：

```
https://YOUR_USERNAME.github.io/iptv-source-aggregator/output/iptv-aggregated.m3u
```

### 使用方法

**TVBOX / PotPlayer**

1. 打开播放器，点击 "添加列表"
2. 选择 "URL订阅"
3. 粘贴 M3U URL
4. 点击 "确定" 或 "加载"

**VLC**

1. 打开 VLC，点击 "媒体" -> "打开网络流"
2. 粘贴 M3U URL
3. 点击 "播放" 即可

## 技术特点

### 源配置

配置文件支持以下类型:

- **静态源**：直接拉取 M3U 文件的 URL
- **动态源**：拉取 JSON 配置文件，获取源列表

配置文件包含:

- 源的 ID、描述和启用状态
- 对应 GitHub raw URL
- 源类型 (static 或 dynamic)
- 输出格式配置
- 验证设置 (超时、重试、用户代理等)
- 频道分类
- 过滤规则

### 频道分类

项目内置多种频道分类:

- 国内卫视 (CCTV、央视等)
- 地方频道 (各省市级台)
- 港澳台 (香港、台湾、澳门)
- 国际频道 (CGTN、NHK、DW等)
- 体育赛事 (Sports、ESPN、FIFA等)
- 影视娱乐 (电影、电视剧、综艺等)
- 纪实文旅 (纪录片、旅游等)
- 新闻资讯 (新闻、财经等)
- 直播平台 (Bilibili、抖音等)

### 过滤规则

可配置:

- 排除组
- 排除关键词
- 最小画质
- 是否优先高清

## 环境配置

### 系统要求

- Node.js >= 18.0
- 8GB RAM (推荐)
- 100MB 存储空间

### 安装 Node.js 和 npm

#### Windows

```powershell
# 下载 Node.js 安装程序
sudo winget install -e Microsoft.Node.js
```

#### macOS

```bash
brew install node
```

#### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install nodejs npm
```

#### Linux (CentOS/RHEL)

```bash
sudo yum install nodejs npm
```

### 安装依赖

```bash
npm install
```

### 运行脚本

```bash
node scripts/generate-playlist.mjs
```

## 贡献

### 贡献者

欢迎贡献！如果你有任何想法、 bug 报告或改进，请通过以下方式联系:

- **GitHub Issue**：https://github.com/YOUR_USERNAME/iptv-source-aggregator/issues
- **Pull Request**：请将 PR 直接提交到 main 分支

### 贡献指南

1. **分支**：请基于 `main` 分支开发
2. **提交信息**：请遵循 Conventional Commits 规范
3. **代码风格**：请使用与项目中相同风格
4. **测试**：请确保所有测试通过

```bash
# 创建热修复分支
git checkout -b feature/your-feature-name

# 提交修改
git add .
git commit -m "feat: 添加功能名称"

# 推送分支
git push origin feature/your-feature-name

# 创建 Pull Request
```

### 修改源配置

要修改或添加新源，请直接编辑 `config/sources.json` 文件：

```json
{
  "sources": {
    "new-source": {
      "enabled": true,
      "description": "新源的描述",
      "url": "https://raw.githubusercontent.com/user/repo/main/file.m3u",
      "type": "static"
    }
  }
}
```

### 修改分类和过滤规则

在 `config/sources.json` 中修改 `categories` 和 `filters` 部分即可。

## 许可证

本项目采用 MIT 许可证。详细信息请参阅 LICENSE 文件。

## 免责声明

本项目仅供学习和测试使用，相关视频源来自 iPTV 项目，发布者不承担任何法律责任，请谨慎使用。相关权利归 iPTV 项目所有。

## 更新日志

### v1.0.0 (2024-12-01)

- 初始版本发布
- 完成基本功能：自动抓取和生成播放列表
- 添加 GitHub Actions 自动更新
- 完成分类和过滤功能

## 联系我们

如果您有任何问题、建议或需要帮助，可以通过以下方式联系我：

- **GitHub Issues**：提交 bug 报告或功能请求
- **Email**：your.email@example.com

## 鸣谢

感谢 iPTV 项目的合作，提供了丰富的电视频道源。我们借鉴了他们的结构和分类方式，以构建这个聚合工具。

## 致谢

1. iPTV 项目 (https://github.com/akiralereal/iptv) - 提供丰富的电视频道源
2. GitHub Actions - 实现自动化构建
3. Node.js - 提供强大的 JavaScript 运行环境
4. GitHub Pages - 提供静态网站托管

## 注意事项

1. 本项目使用的所有视频源均来自 iPTV 项目，仅供学习和测试之用
2. 请遵守相关法律法规，不用于任何非法活动
3. 由于网络环境可能波动，源的可用性可能有所变化
4. 请定期更新源以确保播放列表的最新性

---

祝您愉快地使用 IPTV Source Aggregator！如有任何问题或需要，请随时在 GitHub 上提出 Issue。