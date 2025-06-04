# Prompt Manager (Promma)

[查看中文版本](README_zh.md)

A command-line AI prompt management tool that supports CRUD operations for prompts and integrates Gemini AI for intelligent generation and semantic search.

## ✨ Features

-   🔍 **Prompt Management**: Efficiently create, read, update, and delete your AI prompts.
-   🤖 **AI Intelligent Generation**: Utilize Gemini AI to generate structured prompts based on your descriptions.
-   🧠 **AI Semantic Search**: Find relevant prompts through natural language search, even if you don't remember exact keywords.
-   📊 **Beautiful Display**: Clear and formatted preview of your prompts.
-   📤 **Multiple Export Formats**: Export prompts as plain text, Markdown, or JSON.
-   📂 **Flexible Storage**: Supports custom configuration and data storage paths, compatible with different devices.
-   📦 **Convenient Import**: Batch import prompts from JSON files.
-   ⚡ **Quick Commands**: Supports command aliases for faster operations.

## 🔗 Repository

https://github.com/kunieone/promma.git

## 🚀 Quick Installation

Promma can be installed globally via Bun or npm, allowing you to use the `promma` command from anywhere.

### Install with Bun (Recommended)

If you have [Bun](https://bun.sh/) installed, you can quickly install Promma using the following command:

```bash
bun install -g promma
```

### Install with npm

If you prefer using npm, you can also install it globally with the following command:

```bash
npm install -g promma
```

## ⚙️ Configure Gemini API Key (Optional, for AI Features)

To use the AI generation and AI search features, you need to configure your Gemini API Key.

### 1. Get Your Gemini API Key

1.  Visit [Google AI Studio](https://aistudio.google.com/).
2.  Log in with your Google account.
3.  Click on your profile picture in the top right corner -> "API keys".
4.  Create a new API key.
5.  Copy your API key.

### 2. Configure the Key

Run the `promma config` command in your terminal, then follow the prompts to enter your API key:

```bash
promma config
```

Alternatively, you can configure it by setting an environment variable:

```bash
export GEMINI_API_KEY=your_api_key_here
```

## 💡 Usage

After installation and configuration, you can directly run the `promma` command in your terminal.

### View Help Information

```bash
promma --help
```

### List All Prompts

```bash
promma list
```

Or use aliases:

```bash
promma ls
promma l
```

### Filter by Category and Tags

```bash
promma list -c Writing -t Copywriting
```

### View Prompt Details (Interactive)

```bash
promma view <id>
```

Or use aliases:

```bash
promma v <id>
```

### Create New Prompt

```bash
promma create
```

Or use aliases:

```bash
promma c
promma add
```

### Delete Prompt

```bash
promma delete <id>
```

Or use aliases:

```bash
promma d
promma rm
```

### Generate Prompt with AI

You can directly provide content, or enter interactive mode:

```bash
# Generate directly
promma generate "I need a prompt to help with writing"

# Interactive generation
promma generate
```

Or use aliases:

```bash
promma g
promma gen
```

### AI Semantic Search for Prompts

Based on your description, AI will intelligently match the most relevant prompts:

```bash
promma ai-search "I need help designing a product"
```

Or use aliases:

```bash
promma ai
promma ais
```

### Export Prompt

Supports `text`, `md` (Markdown), `json` formats:

```bash
promma export <id> md
```

Or use aliases:

```bash
promma ex <id> md
```

### Import Prompts

Import prompts from a JSON file. The file content should be an array of prompt objects:

```bash
promma import <filePath>
```

Or use aliases:

```bash
promma i
promma add-file
```

### List All Categories

```bash
promma categories
```

Or use aliases:

```bash
promma cat
```

### List All Tags

```bash
promma tags
```

Or use aliases:

```bash
promma t
promma tag
```

### Clear All Prompt Data (Use with Caution!)

```bash
promma clear-all
```

Or use aliases:

```bash
promma clear
```

### View Digestion History

```bash
promma history
```

Or use aliases:

```bash
promma hist
promma h
```

### Digest Web Content

```bash
promma digest <url> [custom_instruction] [options]
```

- `<url>`: The web page link to digest.
- `[custom_instruction]`: Optional, custom instruction for summarizing the content.
- `[options]`:
  - `-d, --depth <number>`: Recursive crawling depth, defaults to `0` (no recursion, only crawls the initial page). For example, `1` means crawling the initial page and its first level of links, and so on. All collected content will be used as a holistic context for summarization.

**Example:**

```bash
promma digest https://example.com/article "Summarize main points" -d 1
```

## 📂 Data Storage

All prompt data is stored in a local SQLite database, with the default path being `~/.promma/prompts.db`. You can customize the data storage location by setting the `PROMMA_DATA_DIR` environment variable.

API keys and configurations are stored in `~/.promma/config.json`. You can also customize the configuration storage location by setting the `PROMMA_CONFIG_DIR` environment variable.

## 🤝 Contributing

Contributions via Pull Requests or Issue reports are welcome!

## 📄 License

This project is licensed under the MIT License.

---

**Thank you for your support, and we hope Promma becomes a valuable assistant for managing your prompts in your daily work!**
