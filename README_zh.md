# 提示词管理器 (Promma)

[View English Version](README.md)

一个基于命令行的AI提示词管理工具，支持提示词的增删查改，并集成Gemini AI进行智能生成和语义搜索。

## ✨ 功能特点

-   🔍 **提示词管理**: 高效地增删查改您的AI提示词。
-   🤖 **AI智能生成**: 利用Gemini AI根据您的描述生成结构化提示词。
-   🧠 **AI语义搜索**: 即使不记得精确关键词，也能通过自然语言搜索找到相关提示词。
-   📊 **美观展示**: 清晰、格式化的提示词预览。
-   📤 **多种导出**: 将提示词导出为文本、Markdown或JSON格式。
-   📂 **灵活存储**: 支持自定义配置和数据存储路径，兼容不同设备。
-   📦 **便捷导入**: 从JSON文件批量导入提示词。
-   ⚡ **快捷命令**: 支持命令别名，操作更便捷。

## 🚀 快速安装

Promma 可以通过 Bun 或 npm 进行全局安装，让您在任何地方都能使用 `promma` 命令。

### 使用 Bun 安装 (推荐)

如果您已经安装了 [Bun](https://bun.sh/)，可以通过以下命令快速安装：

```bash
bun install -g promma
```

### 使用 npm 安装

如果您更习惯使用 npm，也可以通过以下命令进行全局安装：

```bash
npm install -g promma
```

## ⚙️ 配置 Gemini API 密钥 (可选，用于AI功能)

要使用AI生成和AI搜索功能，您需要配置您的 Gemini API 密钥。

### 1. 获取 Gemini API 密钥

1.  访问 [Google AI Studio](https://aistudio.google.com/)。
2.  登录您的 Google 账号。
3.  点击右上角的头像 -> "API 密钥"。
4.  创建一个新的 API 密钥。
5.  复制您的 API 密钥。

### 2. 配置密钥

在终端中运行 `promma config` 命令，然后按照提示输入您的 API 密钥：

```bash
promma config
```

或者，您也可以通过设置环境变量来配置：

```bash
export GEMINI_API_KEY=your_api_key_here
```

## 💡 使用方法

安装并配置完成后，您可以在终端中直接运行 `promma` 命令。

### 查看帮助信息

```bash
promma --help
```

### 列出所有提示词

```bash
promma list
```

或使用别名：

```bash
promma ls
promma l
```

### 按分类和标签筛选

```bash
promma list -c 写作 -t 文案
```

### 查看提示词详情 (交互式)

```bash
promma view <id>
```

或使用别名：

```bash
promma v <id>
```

### 创建新提示词

```bash
promma create
```

或使用别名：

```bash
promma c
promma add
```

### 删除提示词

```bash
promma delete <id>
```

或使用别名：

```bash
promma d
promma rm
```

### 使用AI生成提示词

您可以直接提供内容，或进入交互式模式：

```bash
# 直接生成
promma generate "我需要一个帮助写作的提示词"

# 交互式生成
promma generate
```

或使用别名：

```bash
promma g
promma gen
```

### 使用AI语义搜索提示词

根据您的描述，AI会智能匹配最相关的提示词：

```bash
promma ai-search "我需要帮助设计一个产品"
```

或使用别名：

```bash
promma ai
promma ais
```

### 导出提示词

支持 `text`, `md` (Markdown), `json` 格式：

```bash
promma export <id> md
```

或使用别名：

```bash
promma ex <id> md
```

### 导入提示词

从JSON文件导入提示词，文件内容应是提示词对象的数组：

```bash
promma import <filePath>
```

或使用别名：

```bash
promma i
promma add-file
```

### 列出所有分类

```bash
promma categories
```

或使用别名：

```bash
promma cat
```

### 列出所有标签

```bash
promma tags
```

或使用别名：

```bash
promma t
promma tag
```

### 清空所有提示词数据 (谨慎操作！)

```bash
promma clear-all
```

或使用别名：

```bash
promma clear
```

## 📂 数据存储

所有提示词数据都存储在本地 SQLite 数据库中，默认路径为 `~/.promma/prompts.db`。您可以通过设置 `PROMMA_DATA_DIR` 环境变量来自定义数据存储位置。

API 密钥和配置存储在 `~/.promma/config.json`，您也可以通过设置 `PROMMA_CONFIG_DIR` 环境变量来自定义配置存储位置。

## 🤝 贡献

欢迎通过提交 Pull Request 或报告 Issue 来贡献代码！

## 📄 许可证

本项目使用 MIT 许可证。

---

**感谢您的支持，希望 Promma 能成为您日常工作中管理提示词的得力助手！** 