import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import { table } from 'table';
import { geminiService, saveApiKey, getApiKey, getConfigDir, ensureApiKey } from '../services/geminiService';
import { aiSearchService } from '../services/aiSearchService';
import inquirer from 'inquirer';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import boxen from 'boxen';
import clipboardy from 'clipboardy';
import ora from 'ora';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { createPrompt, getPromptById, deletePrompt, updatePrompt, getAllPrompts, searchPrompts, clearAllPrompts, type Prompt } from '../models/promptModel';
import { getDataDir as getPromptDataDir } from '../models/promptModel';
import { getHistoryDataDir, getAllHistoryEntries, getHistoryEntryById, deleteHistoryEntry, clearAllHistoryEntries, type HistoryEntry } from '../models/contentModel';
import { digestService } from '../services/digestService';

// 新增接口
interface DigestedPage {
  url: string;
  instruction?: string;
  summary: string;
  foundLinks: string[];
  depth: number; // 记录当前页面的抓取深度，方便后续逻辑判断
}

interface MyInquirerChoice {
  key: string;
  name: string;
  value: string;
}

// 配置Markdown终端渲染器
// 使用类型断言解决类型兼容问题
marked.setOptions({
  renderer: new TerminalRenderer() as any
});

const dataDir = getPromptDataDir();

// 确保数据目录存在
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// 显示表格
const displayTable = (data: any[]) => {
  console.log(table(data));
};

// 美化显示单个提示词
const displayPrompt = (prompt: Prompt) => {
  const descriptionText = prompt.description ? `\n\n${chalk.italic(prompt.description)}` : '';
  const tagsText = prompt.tags ? `\n\n${chalk.yellow('标签:')} ${prompt.tags}` : '';
  
  console.log(boxen(
    `${chalk.bold(chalk.blue(prompt.title))} ${chalk.gray(`[${prompt.category}]`)}${descriptionText}\n\n` +
    `${marked(prompt.content)}${tagsText}\n\n` +
    `${chalk.dim(`ID: ${prompt.id} | 创建于: ${new Date(prompt.created_at!).toLocaleString()} | 更新于: ${new Date(prompt.updated_at!).toLocaleString()}`)}`,
    { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'blue' }
  ));
};

// 辅助函数：美化显示单个历史记录
const displayHistoryEntry = (entry: HistoryEntry) => {
  console.log(boxen(
    `${chalk.bold(chalk.blue('消化历史'))}\n\n` +
    `${chalk.blue('原始链接:')} ${entry.url}\n\n` +
    `${entry.instruction ? `${chalk.blue('总结指令:')} ${entry.instruction}\n\n` : ''}` +
    `${chalk.green('总结内容:')}\n${marked(entry.summary)}\n\n` +
    `${chalk.dim(`ID: ${entry.id} | 创建于: ${new Date(entry.created_at!).toLocaleString()}`)}`,
    { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'cyan' }
  ));
};

// 辅助函数：历史记录交互式视图
const historyInteractiveView = async (entry: HistoryEntry) => {
  let currentEntry = entry;

  while (true) {
    displayHistoryEntry(currentEntry);
    const { action } = await inquirer.prompt([
      {
        type: 'expand',
        name: 'action',
        message: '请选择操作:',
        choices: [
          { key: 'c', name: '复制总结内容', value: 'copy' },
          { key: 'd', name: '删除此记录', value: 'delete' },
          { key: 'q', name: '退出', value: 'quit' }
        ],
        default: 'q'
      }
    ]);

    if (action === 'copy') {
      clipboardy.writeSync(currentEntry.summary);
      console.log(chalk.green('总结内容已成功复制到剪贴板！'));
      break;
    } else if (action === 'delete') {
      const success = deleteHistoryEntry(Number(currentEntry.id));
      if (success) {
        console.log(chalk.green(`历史记录删除成功，ID: ${currentEntry.id}`));
        break;
      } else {
        console.log(chalk.red('历史记录删除失败'));
      }
    } else if (action === 'quit') {
      break;
    }
  }
};

// 辅助函数：删除提示词逻辑
const executeDeletePrompt = async (id: number) => {
  try {
    const prompt = getPromptById(id);
    if (!prompt) {
      console.log(chalk.red(`未找到ID为 ${id} 的提示词`));
      return false;
    }

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `确定要删除提示词 "${prompt.title}" 吗？`,
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.yellow('已取消删除'));
      return false;
    }

    const success = deletePrompt(id);
    if (success) {
      console.log(chalk.green(`提示词删除成功，ID: ${id}`));
      return true;
    } else {
      console.log(chalk.red('提示词删除失败'));
      return false;
    }
  } catch (error) {
    console.error(chalk.red('删除提示词失败:'), error);
    return false;
  }
};

// 辅助函数：提示词交互式视图
const promptInteractiveView = async (initialPrompt: Prompt) => {
  let currentPrompt = initialPrompt;

  while (true) {
    displayPrompt(currentPrompt);
    const { action } = await inquirer.prompt([
      {
        type: 'expand',
        name: 'action',
        message: '请选择操作:',
        choices: [
          { key: 'c', name: '复制内容', value: 'copy' },
          { key: 'd', name: '删除提示词', value: 'delete' },
          { key: 'q', name: '退出', value: 'quit' }
        ],
        default: 'q'
      }
    ]);

    if (action === 'copy') {
      clipboardy.writeSync(currentPrompt.content);
      console.log(chalk.green('提示词内容已成功复制到剪贴板！'));
      break; // 复制后退出
    } else if (action === 'delete') {
      const success = await executeDeletePrompt(Number(currentPrompt.id));
      if (success) {
        break; // 删除成功后退出循环
      }
      // 如果删除被取消，继续显示菜单
    } else if (action === 'quit') {
      break; // 退出循环
    }
  }
};

// 辅助函数：处理消化命令的逻辑
const handleDigestCommand = async (
  url: string,
  instruction: string | undefined,
  initialDepth: number,
  navigationStack: DigestedPage[] = [] // 新增导航栈参数
) => {
  try {
    const depth = initialDepth;
    // Show a spinner while digesting
    const spinner = ora(chalk.blue('正在消化网页内容，请稍候...')).start();

    const { result, error } = await digestService.digestUrl(url, instruction, depth, (message: string) => {
      spinner.text = chalk.blue(message);
    });

    if (error) {
      spinner.fail(chalk.red(`消化失败: ${error}`));
      return;
    }

    spinner.succeed(chalk.green('网页内容消化完成！'));

    if (result) {
      const summaryMarkdown = result.summary;

      // Display the summary
      console.log(boxen(
        `${chalk.bold(chalk.blue('AI 总结'))}\n\n` +
        `${marked(summaryMarkdown)}\n\n` +
        `${chalk.dim(`原文链接: ${result.url}`)}`,
        { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'green' }
      ));

      // Offer to copy
      // Refactor this into a loop to allow flexible navigation
      let currentDigestedPage: DigestedPage = {
        url: result.url,
        instruction: instruction,
        summary: summaryMarkdown,
        foundLinks: result.foundLinks,
        depth: depth
      };

      // Push current page to stack
      navigationStack.push(currentDigestedPage);

      // Start interactive loop
      while (true) {
        let choices: MyInquirerChoice[] = [
          { key: 'c', name: '复制总结内容', value: 'copy' },
          { key: 'q', name: '退出', value: 'quit' }
        ];

        if (currentDigestedPage.foundLinks && currentDigestedPage.foundLinks.length > 0) {
          choices.push({ key: 'l', name: '查看并下钻相关链接', value: 'list_links' });
        }

        if (navigationStack.length > 1) { // If there's a previous page in history
          choices.push({ key: 'u', name: '返回上一层', value: 'up' });
        }

        choices.push({ key: '?', name: '帮助', value: 'help' });

        const { action } = await inquirer.prompt([
          {
            type: 'expand',
            name: 'action',
            message: '请选择操作:',
            choices: choices,
            default: 'q'
          }
        ]);

        if (action === 'copy') {
          clipboardy.writeSync(currentDigestedPage.summary);
          console.log(chalk.green('总结内容已成功复制到剪贴板！'));
        } else if (action === 'quit') {
          break; // Exit the loop
        } else if (action === 'list_links') {
          // Display links and prompt for drill down
          const { selectedLink } = await inquirer.prompt([
            {
              type: 'list',
              name: 'selectedLink',
              message: '请选择要下钻的链接:',
              choices: currentDigestedPage.foundLinks.map((link, index) => {
                const decodedLink = decodeURIComponent(link);
                return {
                  name: `${index + 1}. ${decodedLink.length > 80 ? decodedLink.substring(0, 77) + '...' : decodedLink}`,
                  value: link
                };
              }),
              pageSize: 10
            }
          ]);
          
          // Recursively call handleDigestCommand for the selected link with depth 0
          await handleDigestCommand(selectedLink, instruction, 0, navigationStack);
          
          // After recursive call returns, ensure currentDigestedPage is up-to-date
          currentDigestedPage = navigationStack[navigationStack.length - 1]!;

          // Continue the loop to display the new current page or previous if back button used
        } else if (action === 'up') {
          if (navigationStack.length > 1) {
            navigationStack.pop(); // Pop current page
            currentDigestedPage = navigationStack[navigationStack.length - 1]!; // Get previous page
            console.log(chalk.blue('已返回上一层。'));
            // Re-display the previous page's summary
            console.log(boxen(
              `${chalk.bold(chalk.blue('AI 总结'))}\n\n` +
              `${marked(currentDigestedPage.summary)}\n\n` +
              `${chalk.dim(`原文链接: ${currentDigestedPage.url}`)}`,
              { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'green' }
            ));
          } else {
            console.log(chalk.yellow('已是顶层，无法返回。'));
          }
        } else if (action === 'help') {
          console.log(boxen(
            `${chalk.bold(chalk.blue('帮助信息'))}\n\n` +
            `  ${chalk.cyan('c')}: 复制当前总结内容到剪贴板。\n` +
            `  ${chalk.cyan('q')}: 退出消化会话。\n` +
            `  ${chalk.cyan('l')}: 列出当前页面发现的链接，并选择下钻。\n` +
            `  ${chalk.cyan('u')}: 返回到上一个消化的页面 (如果存在)。\n` +
            `  ${chalk.cyan('?')}: 显示此帮助信息。\n\n` +
            `提示: 通过下钻链接或返回上一层，可以在消化历史中灵活导航。`,
            { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'yellow' }
          ));
        }
      }
    }
  } catch (error) {
    console.error(chalk.red('消化功能发生错误:'), error);
  }
};

// 初始化命令行程序
export const initCommands = async () => {
  const program = new Command();

  // Display title only on help
  program.on('--help', () => {
    console.log(chalk.blue(figlet.textSync('Promma', { horizontalLayout: 'full' })));
  });

  program
    .name('promma')
    .description('一个强大的AI提示词管理工具')
    .version('0.1.0');

  // List all prompts
  program
    .command('list')
    .aliases(['ls', 'l']) // Add alias
    .description('列出所有提示词')
    .option('-c, --category <category>', '按分类筛选')
    .option('-t, --tag <tag>', '按标签筛选')
    .action(async (options) => {
      try {
        let prompts;
        
        if (options.category && options.tag) {
          // Filter by category and tag
          prompts = getAllPrompts().filter((p: Prompt) => p.category === options.category && p.tags && p.tags.includes(options.tag));
        } else if (options.category) {
          // Filter by category only
          prompts = getAllPrompts().filter((p: Prompt) => p.category === options.category);
        } else if (options.tag) {
          // Filter by tag only
          prompts = getAllPrompts().filter((p: Prompt) => p.tags && p.tags.includes(options.tag));
        } else {
          // Get all
          prompts = getAllPrompts();
        }
        
        if (prompts.length === 0) {
          console.log(chalk.yellow('没有找到提示词'));
          return;
        }

        const { promptId } = await inquirer.prompt([
          {
            type: 'list',
            name: 'promptId',
            message: '选择一个提示词 (按Enter查看详情，在详情页可复制/删除/退出): ',
            choices: prompts.map((p: Prompt) => ({
              name: `${p.title} [ID: ${p.id}]${p.category ? ` (分类: ${p.category})` : ''}`, 
              value: p.id
            })),
            pageSize: 10 // Limit display to 10 choices at a time
          }
        ]);

        const selectedPrompt = getPromptById(Number(promptId));
        if (selectedPrompt) {
          await promptInteractiveView(selectedPrompt); // Call interactive view
        } else {
          console.log(chalk.red('未找到选定的提示词。'));
        }

      } catch (error) {
        console.error(chalk.red('列出提示词失败:'), error);
      }
    });

  // View single prompt
  program
    .command('view <id>')
    .aliases(['v']) // Add alias
    .description('查看提示词详情')
    .action(async (id) => {
      try {
        const prompt = getPromptById(Number(id));
        if (!prompt) {
          console.log(chalk.red(`未找到ID为 ${id} 的提示词`));
          return;
        }
        await promptInteractiveView(prompt); // Call the new interactive view function
      } catch (error) {
        console.error(chalk.red('查看提示词失败:'), error);
      }
    });

  // Create prompt
  program
    .command('create')
    .aliases(['c', 'add']) // Add alias
    .description('创建新提示词')
    .action(async () => {
      try {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'title',
            message: '提示词标题:',
            validate: (input) => input.trim() !== '' ? true : '标题不能为空'
          },
          {
            type: 'input',
            name: 'category',
            message: '分类:',
            default: '未分类'
          },
          {
            type: 'editor',
            name: 'content',
            message: '提示词内容:',
            validate: (input) => input.trim() !== '' ? true : '内容不能为空'
          }
        ]);

        const id = createPrompt({
          title: answers.title,
          content: answers.content,
          category: answers.category
        });

        console.log(chalk.green(`提示词创建成功，ID: ${id}`));
      } catch (error) {
        console.error(chalk.red('创建提示词失败:'), error);
      }
    });

  // Delete prompt
  program
    .command('delete <id>')
    .aliases(['d', 'rm']) // Add alias
    .description('删除提示词')
    .action(async (id) => {
      await executeDeletePrompt(Number(id));
    });

  // Search prompts
  program
    .command('search <keyword>')
    .aliases(['s', 'find']) // Add alias
    .description('搜索提示词')
    .action(async (keyword) => {
      try {
        const prompts = searchPrompts(keyword);
        
        if (prompts.length === 0) {
          console.log(chalk.yellow(`没有找到匹配 "${keyword}" 的提示词`));
          return;
        }

        const tableData = [
          ['ID', '标题', '分类', '更新时间'],
          ...prompts.map((p: Prompt) => [
            p.id?.toString() || '', 
            p.title, 
            p.category || '未分类', 
            new Date(p.updated_at!).toLocaleString()
          ])
        ];

        displayTable(tableData);
        console.log(chalk.green(`找到 ${prompts.length} 个匹配 "${keyword}" 的提示词`));
      } catch (error) {
        console.error(chalk.red('搜索提示词失败:'), error);
      }
    });

  // List all categories
  program
    .command('categories')
    .aliases(['cat']) // Add alias
    .description('列出所有分类')
    .action(async () => {
      try {
        const categories = getAllPrompts().map((p: Prompt) => p.category).filter((c, i, a) => a.indexOf(c) === i);
        
        if (categories.length === 0) {
          console.log(chalk.yellow('暂无分类'));
          return;
        }

        console.log(chalk.blue('所有分类:'));
        categories.forEach((category, index) => {
          console.log(`${index + 1}. ${category}`);
        });
        console.log(chalk.green(`共 ${categories.length} 个分类`));
      } catch (error) {
        console.error(chalk.red('获取分类失败:'), error);
      }
    });

  // Generate prompt
  program
    .command('generate [input]')
    .aliases(['g', 'gen']) // Add alias
    .description('使用Gemini AI生成提示词')
    .action(async (input) => {
      try {
        // Check API key
        const apiKey = getApiKey();
        if (!apiKey) {
          console.log(chalk.yellow('您尚未配置Gemini API密钥'));
          const { setupNow } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'setupNow',
              message: '是否现在配置API密钥?',
              default: true
            }
          ]);

          if (!setupNow) {
            console.log(chalk.blue('您可以稍后使用 "promma config" 命令设置API密钥'));
            return;
          }

          const { apiKey: userApiKey } = await inquirer.prompt([
            {
              type: 'password',
              name: 'apiKey',
              message: '请输入您的Gemini API密钥:',
              validate: (input) => {
                if (!input) return '密钥不能为空';
                return true;
              }
            }
          ]);

          const success = saveApiKey(userApiKey);
          if (!success) {
            console.log(chalk.red('保存API密钥失败，请稍后再试'));
            return;
          }
        }

        // Get user input if not provided
        const userInput = input || (await inquirer.prompt([
          {
            type: 'input',
            name: 'input',
            message: '请描述你需要的提示词类型（应用场景/目标/期望效果等）:',
            validate: (input) => input.trim() !== '' ? true : '输入不能为空'
          }
        ])).input;

        const spinner = ora('正在生成提示词...').start();
        
        const result = await geminiService.generateStructuredPrompt(userInput);
        
        spinner.stop();
        
        if (result.error) {
          console.log(chalk.red(`生成提示词失败: ${result.error}`));
          return;
        }

        // Display structured data
        if (result.structured) {
          const { title, description, content, tags } = result.structured;
          
          console.log(boxen(
            `${chalk.bold(chalk.blue(title))}\n\n` +
            `${chalk.italic(description)}\n\n` +
            `${chalk.green('内容:')}\n${content}\n\n` +
            `${chalk.yellow('标签:')} ${tags.join(', ')}`,
            { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'blue' }
          ));
        } else {
          // Fallback to display raw text
          console.log(boxen(
            chalk.green('生成的提示词:') + '\n\n' +
            marked(result.text),
            { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'green' }
          ));
        }

        const { save } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'save',
            message: '是否保存此提示词?',
            default: true
          }
        ]);

        if (save) {
          // If structured data exists, use it
          if (result.structured) {
            const { title, description, content, tags } = result.structured;
            
            // Add category option
            const { category } = await inquirer.prompt([
              {
                type: 'input',
                name: 'category',
                message: '分类:',
                default: '未分类'
              }
            ]);
            
            const id = createPrompt({
              title,
              description,
              content,
              tags: tags.join(', '),
              category
            });

            console.log(chalk.green(`提示词保存成功，ID: ${id}`));
          } else {
            // Otherwise, prompt user for information
            const { title, description, category, tags } = await inquirer.prompt([
              {
                type: 'input',
                name: 'title',
                message: '提示词标题:',
                validate: (input) => input.trim() !== '' ? true : '标题不能为空'
              },
              {
                type: 'input',
                name: 'description',
                message: '简短描述:',
                default: ''
              },
              {
                type: 'input',
                name: 'category',
                message: '分类:',
                default: '未分类'
              },
              {
                type: 'input',
                name: 'tags',
                message: '标签 (逗号分隔):',
                default: ''
              }
            ]);

            const id = createPrompt({
              title,
              description,
              content: result.text,
              tags,
              category
            });

            console.log(chalk.green(`提示词保存成功，ID: ${id}`));
          }
        }
      } catch (error) {
        console.error(chalk.red('生成提示词失败:'), error);
      }
    });

  // Export prompt
  program
    .command('export <id> [format]')
    .aliases(['ex']) // Add alias
    .description('导出提示词 (支持格式: text, md, json)')
    .action(async (id, format = 'text') => {
      try {
        const prompt = getPromptById(Number(id));
        if (!prompt) {
          console.log(chalk.red(`未找到ID为 ${id} 的提示词`));
          return;
        }

        switch (format.toLowerCase()) {
          case 'text':
            console.log(prompt.content);
            break;
          case 'md':
            const descriptionMd = prompt.description ? `\n\n> ${prompt.description}` : '';
            const tagsMd = prompt.tags ? `\n> 标签: ${prompt.tags}` : '';
            console.log(`# ${prompt.title}${descriptionMd}\n\n${prompt.content}\n\n> 分类: ${prompt.category || '未分类'}${tagsMd}`);
            break;
          case 'json':
            console.log(JSON.stringify(prompt, null, 2));
            break;
          default:
            console.log(chalk.red(`不支持的格式: ${format}`));
        }
      } catch (error) {
        console.error(chalk.red('导出提示词失败:'), error);
      }
    });

  // Add config command
  program
    .command('config')
    .aliases(['conf']) // Add alias
    .description('配置工具设置')
    .option('-s, --show', '显示当前配置')
    .action(async (options) => {
      try {
        // If showing config
        if (options.show) {
          const apiKey = getApiKey();
          if (apiKey) {
            console.log(chalk.green('API密钥已配置'));
            console.log(chalk.dim(`密钥前缀: ${apiKey.substring(0, 5)}...`));
          } else {
            console.log(chalk.yellow('API密钥尚未配置'));
            console.log(chalk.blue('请使用 "promma config" 命令设置API密钥'));
          }
          return;
        }

        // Prompt user for Gemini API key - This part remains for direct config command.
        const { apiKey } = await inquirer.prompt([
          {
            type: 'password',
            name: 'apiKey',
            message: '请输入您的Gemini API密钥:',
            validate: (input) => {
              if (!input) return '密钥不能为空';
              return true;
            }
          }
        ]);
        
        // Save API key
        const success = saveApiKey(apiKey);
        
        if (success) {
          console.log(chalk.green('API密钥已成功保存！'));
          console.log(chalk.blue('现在您可以使用 "promma generate" 命令来生成提示词了。'));
        } else {
          console.log(chalk.red('保存API密钥失败'));
        }
      } catch (error) {
        console.error(chalk.red('配置失败:'), error);
      }
    });

  // List all tags
  program
    .command('tags')
    .aliases(['t', 'tag']) // Add alias
    .description('列出所有标签')
    .action(async () => {
      try {
        const tags = getAllPrompts().map((p: Prompt) => p.tags).filter((t, i, a) => a.indexOf(t) === i).sort();
        
        if (tags.length === 0) {
          console.log(chalk.yellow('暂无标签'));
          return;
        }

        console.log(chalk.blue('所有标签:'));
        tags.forEach((tag, index) => {
          console.log(`${index + 1}. ${tag}`);
        });
        console.log(chalk.green(`共 ${tags.length} 个标签`));
      } catch (error) {
        console.error(chalk.red('获取标签失败:'), error);
      }
    });

  // AI search prompts
  program
    .command('ai-search <query>')
    .aliases(['ai', 'ais']) // Add alias
    .description('使用AI进行语义搜索，查找相关提示词')
    .option('-l, --limit <number>', '结果数量限制', '5')
    .action(async (query, options) => {
      try {
        // Check API key
        const apiKey = getApiKey();
        if (!apiKey) {
          console.log(chalk.yellow('您尚未配置Gemini API密钥'));
          const { setupNow } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'setupNow',
              message: '是否现在配置API密钥?',
              default: true
            }
          ]);

          if (!setupNow) {
            console.log(chalk.blue('您可以稍后使用 "promma config" 命令设置API密钥'));
            return;
          }

          const { apiKey: userApiKey } = await inquirer.prompt([
            {
              type: 'password',
              name: 'apiKey',
              message: '请输入您的Gemini API密钥:',
              validate: (input) => {
                if (!input) return '密钥不能为空';
                return true;
              }
            }
          ]);

          const success = saveApiKey(userApiKey);
          if (!success) {
            console.log(chalk.red('保存API密钥失败，请稍后再试'));
            return;
          }
        }

        const limit = parseInt(options.limit) || 5;
        
        const spinner = ora('正在进行AI语义搜索...').start();
        
        const result = await aiSearchService.searchPrompts(query, limit);
        
        spinner.stop();
        
        if (result.error) {
          console.log(chalk.red(`搜索失败: ${result.error}`));
          return;
        }

        if (result.prompts.length === 0) {
          console.log(chalk.yellow('没有找到匹配的提示词'));
          return;
        }

        console.log(chalk.blue(`找到 ${result.prompts.length} 个相关提示词:\n`));
        
        // Display search results
        result.prompts.forEach((prompt, index) => {
          const relevanceColor = 
            prompt.relevance > 0.8 ? chalk.green :
            prompt.relevance > 0.6 ? chalk.blue :
            chalk.yellow;
          
          console.log(boxen(
            `${chalk.bold(chalk.blue(prompt.title))} ${chalk.gray(`[${prompt.category}]`)}\n\n` +
            `${chalk.italic(prompt.description || '')}\n\n` +
            `${relevanceColor(`相关度: ${Math.round(prompt.relevance * 100)}%`)}\n` +
            `${chalk.gray(`原因: ${prompt.reason}`)}\n\n` +
            `${chalk.dim(`ID: ${prompt.id}`)}`,
            { 
              padding: 1, 
              margin: {top: 0, bottom: 1, left: 0, right: 0}, 
              borderStyle: 'round', 
              borderColor: relevanceColor === chalk.green ? 'green' : 
                           relevanceColor === chalk.blue ? 'blue' : 'yellow'
            }
          ));
        });
        
        // View details option
        if (result.prompts.length > 0) {
          const { viewDetails } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'viewDetails',
              message: '是否查看提示词详情?',
              default: false
            }
          ]);
          
          if (viewDetails) {
            const { promptId } = await inquirer.prompt([
              {
                type: 'list',
                name: 'promptId',
                message: '选择要查看的提示词:',
                choices: result.prompts.map(p => ({
                  name: `${p.title} (相关度: ${Math.round(p.relevance * 100)}%)`, 
                  value: p.id
                }))
              }
            ]);
            
            const selectedPrompt = getPromptById(Number(promptId));
            if (selectedPrompt) {
              await promptInteractiveView(selectedPrompt); // Call interactive view
            }
          }
        }
      } catch (error) {
        console.error(chalk.red('AI搜索失败:'), error);
      }
    });

  // Clear all prompts
  program
    .command('clear-all')
    .aliases(['clear']) // Add alias
    .description('清空所有提示词数据（此操作不可逆！')
    .action(async () => {
      try {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: chalk.red('您确定要清空所有提示词数据吗？此操作不可逆！'),
            default: false
          }
        ]);

        if (!confirm) {
          console.log(chalk.yellow('已取消清空操作'));
          return;
        }

        const success = clearAllPrompts();
        if (success) {
          console.log(chalk.green('所有提示词数据已成功清空！'));
        } else {
          console.log(chalk.red('清空提示词数据失败'));
        }
      } catch (error) {
        console.error(chalk.red('清空提示词数据失败:'), error);
      }
    });

  // Digest URL
  program
    .command('digest <url> [instruction]')
    .description('消化一个链接内容并输出AI总结的Markdown内容，可自定义总结指令。支持递归抓取网页内容。')
    .option('-d, --depth <number>', '递归抓取深度，默认为0 (不递归，只抓取初始页面)，1表示抓取初始页面及其第一层链接，以此类推。', '0')
    .action(async (url: string, instruction: string | undefined, options: { depth?: string }) => {
      const initialDepth = parseInt(options.depth || '0', 10);
      await handleDigestCommand(url, instruction, initialDepth);
    });

  // History command
  program
    .command('history')
    .aliases(['hist', 'h']) // Add alias
    .description('查看消化历史记录')
    .action(async () => {
      try {
        const historyEntries = getAllHistoryEntries();

        if (historyEntries.length === 0) {
          console.log(chalk.yellow('暂无历史记录'));
          return;
        }

        const { entryId } = await inquirer.prompt([
          {
            type: 'list',
            name: 'entryId',
            message: '选择一个历史记录 (按Enter查看详情，在详情页可复制/删除/退出): ',
            choices: historyEntries.map((e: HistoryEntry) => ({
              name: `${new Date(e.created_at!).toLocaleString()} - ${e.url.substring(0, 50)}${e.url.length > 50 ? '...' : ''}`,
              value: e.id
            })),
            pageSize: 10 // Limit display to 10 choices at a time
          }
        ]);

        const selectedEntry = getHistoryEntryById(Number(entryId));
        if (selectedEntry) {
          await historyInteractiveView(selectedEntry); // Call interactive view
        } else {
          console.log(chalk.red('未找到选定的历史记录。'));
        }

      } catch (error) {
        console.error(chalk.red('查看历史记录失败:'), error);
      }
    });

  // Import prompts from JSON file
  program
    .command('import <filePath>')
    .aliases(['add-file', 'imp']) // Add alias for import command
    .description('从JSON文件导入提示词')
    .action(async (filePath) => {
      try {
        const absolutePath = resolve(process.cwd(), filePath);
        if (!existsSync(absolutePath)) {
          console.log(chalk.red(`文件未找到: ${filePath}`));
          return;
        }

        const fileContent = readFileSync(absolutePath, 'utf-8');
        let promptsToImport: Prompt[];

        try {
          promptsToImport = JSON.parse(fileContent);
          if (!Array.isArray(promptsToImport)) {
            console.log(chalk.red('JSON文件内容必须是提示词数组'));
            return;
          }
        } catch (jsonError) {
          console.log(chalk.red(`解析JSON文件失败: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`));
          return;
        }

        let importedCount = 0;
        for (const promptData of promptsToImport) {
          try {
            // Basic validation for required fields
            if (!promptData.title || !promptData.content) {
              console.warn(chalk.yellow(`跳过无效提示词（缺少标题或内容）: ${JSON.stringify(promptData).substring(0, 50)}...`));
              continue;
            }
            createPrompt(promptData);
            importedCount++;
          } catch (dbError) {
            console.error(chalk.red(`导入提示词失败: ${promptData.title || '未知标题'} - ${dbError instanceof Error ? dbError.message : String(dbError)}`));
          }
        }

        console.log(chalk.green(`成功导入 ${importedCount} 个提示词。`));
        if (importedCount < promptsToImport.length) {
          console.log(chalk.yellow(`有 ${promptsToImport.length - importedCount} 个提示词导入失败或被跳过。`));
        }

      } catch (error) {
        console.error(chalk.red('导入提示词失败:'), error);
      }
    });

  return program;
};
 