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
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 200,
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
    
    // 构建上下文信息
    let context = `## Git Diff (暂存区变更)\n\n${diff}\n\n`;
    
    // 对每个变更的文件，获取其当前内容
    context += `## 变更文件的当前内容\n\n`;
    
    for (const file of changedFiles) {
      if (fs.existsSync(file)) {
        try {
          const content = fs.readFileSync(file, 'utf-8');
          const ext = path.extname(file);
          context += `### ${file}\n\n\`\`\`${ext.slice(1)}\n${content}\n\`\`\`\n\n`;
        } catch (error) {
          context += `### ${file}\n\n[无法读取文件内容]\n\n`;
        }
      }
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
    const prompt = `你是一个 Git 提交信息生成专家。请根据以下代码变更生成一个简洁、准确的提交信息。

要求：
1. 提交信息应该简洁明了，通常不超过 50 个字符
2. 使用动词开头（如：fix, feat, refactor, docs, style, test, chore）
3. 说明做了什么，而不是如何做的
4. 如果是功能性更改，说明其目的或影响
5. 使用中文描述，但类型前缀使用英文
6. 格式：<type>: <subject>
   - feat: 新功能
   - fix: 修复bug
   - docs: 文档更新
   - style: 代码格式调整
   - refactor: 代码重构
   - test: 测试相关
   - chore: 构建过程或辅助工具的变动

代码变更上下文：
${context}

请生成一个符合上述要求的提交信息：`;

    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
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