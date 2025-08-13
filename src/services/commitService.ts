import { execSync } from 'child_process';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import boxen from 'boxen';

export class CommitService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash-preview-05-20',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000,
        topK: 40,
        topP: 0.95,
      }
    });
  }

  async generateCommitMessage(): Promise<void> {
    try {
      // 检查是否有暂存的更改
      const stagedChanges = this.getStagedChanges();
      if (!stagedChanges.trim()) {
        console.log(chalk.yellow('没有发现暂存的更改。请先使用 git add 添加要提交的文件。'));
        return;
      }

      const spinner = ora('正在分析代码变更...').start();

      // 获取变更的上下文信息
      const context = await this.getChangeContext(stagedChanges);
      
      // 生成提交信息
      const commitMessage = await this.generateMessage(context);
      
      spinner.succeed('提交信息生成完成');

      // 显示生成的提交信息
      this.displayCommitMessage(commitMessage);

      // 用户交互
      await this.handleUserInteraction(commitMessage, context);

    } catch (error) {
      console.error(chalk.red('生成提交信息时出错:'), error);
    }
  }

  private getStagedChanges(): string {
    try {
      return execSync('git diff --cached', { encoding: 'utf-8' });
    } catch (error) {
      throw new Error('获取暂存更改失败');
    }
  }

  private async getChangeContext(diff: string): Promise<string> {
    // 获取变更的文件列表
    const changedFiles = this.getChangedFiles();
    
    // 限制 diff 大小（保留前 3000 字符）
    const truncatedDiff = diff.length > 3000 ? diff.substring(0, 3000) + '\n... [diff 已截断]' : diff;
    
    // 构建上下文信息
    let context = `## Git Diff (暂存区变更)\n\n${truncatedDiff}\n\n`;
    
    // 对每个变更的文件，获取其当前内容（限制每个文件最多 1000 字符）
    context += `## 变更文件的当前内容\n\n`;
    
    for (const file of changedFiles.slice(0, 5)) { // 最多处理 5 个文件
      if (fs.existsSync(file)) {
        try {
          const content = fs.readFileSync(file, 'utf-8');
          const ext = path.extname(file);
          const truncatedContent = content.length > 1000 ? content.substring(0, 1000) + '\n... [文件内容已截断]' : content;
          context += `### ${file}\n\n\`\`\`${ext.slice(1)}\n${truncatedContent}\n\`\`\`\n\n`;
        } catch (error) {
          context += `### ${file}\n\n[无法读取文件内容]\n\n`;
        }
      }
    }
    
    if (changedFiles.length > 5) {
      context += `\n... 还有 ${changedFiles.length - 5} 个文件被省略\n`;
    }
    
    return context;
  }

  private getChangedFiles(): string[] {
    try {
      const output = execSync('git diff --cached --name-only', { encoding: 'utf-8' });
      return output.trim().split('\n').filter(file => file.length > 0);
    } catch (error) {
      return [];
    }
  }

  private async generateMessage(context: string): Promise<string> {
    const prompt = `分析以下 Git 代码变更，生成一个规范的提交信息。

提交信息格式要求：
- 格式：<type>: <description>
- type 必须是以下之一：feat, fix, docs, style, refactor, test, chore
- description 使用中文，简洁明了（不超过50字符）
- 描述做了什么，不是怎么做的

类型说明：
- feat: 新增功能
- fix: 修复缺陷
- docs: 文档变更
- style: 代码格式调整（不影响功能）
- refactor: 代码重构（不影响功能）
- test: 测试相关
- chore: 构建/工具/依赖等变更

${context}

直接输出提交信息，不要有其他内容：`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      
      // 检查响应内容
      if (!response.candidates || response.candidates.length === 0) {
        throw new Error('模型未返回有效响应');
      }
      
      const candidate = response.candidates[0];
      if (!candidate || !candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        console.error('响应候选内容:', JSON.stringify(candidate, null, 2));
        throw new Error('模型响应为空');
      }
      
      const text = candidate.content.parts[0]?.text || '';
      return text.trim();
    } catch (error) {
      console.error('生成消息时出错:', error);
      throw error;
    }
  }

  private displayCommitMessage(message: string) {
    console.log('\n' + boxen(message, {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'green',
      title: '生成的提交信息',
      titleAlignment: 'center'
    }));
  }

  private async handleUserInteraction(commitMessage: string, context: string): Promise<void> {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '请选择操作:',
        choices: [
          { name: '✅ 使用此提交信息', value: 'use' },
          { name: '🔄 重新生成', value: 'regenerate' },
          { name: '✏️  编辑提交信息', value: 'edit' },
          { name: '❌ 取消', value: 'cancel' }
        ]
      }
    ]);

    switch (action) {
      case 'use':
        await this.performCommit(commitMessage);
        break;
      case 'regenerate':
        const spinner = ora('重新生成提交信息...').start();
        const newMessage = await this.generateMessage(context);
        spinner.succeed('重新生成完成');
        this.displayCommitMessage(newMessage);
        await this.handleUserInteraction(newMessage, context);
        break;
      case 'edit':
        const { editedMessage } = await inquirer.prompt([
          {
            type: 'editor',
            name: 'editedMessage',
            message: '编辑提交信息:',
            default: commitMessage
          }
        ]);
        await this.performCommit(editedMessage.trim());
        break;
      case 'cancel':
        console.log(chalk.yellow('已取消提交'));
        break;
    }
  }

  private async performCommit(message: string): Promise<void> {
    try {
      execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
      console.log(chalk.green('✅ 提交成功！'));
    } catch (error) {
      console.error(chalk.red('提交失败:'), error);
    }
  }
}