import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import inquirer from 'inquirer';
import chalk from 'chalk';
import type { GenerationConfig } from '../types/gemini';

// 默认模型名称
const MODEL_NAME = 'gemini-2.5-flash-preview-05-20';

// 获取配置目录，支持自定义配置
export function getConfigDir(): string {
  // 1. 优先使用环境变量
  if (process.env.PROMMA_CONFIG_DIR) {
    const dir = process.env.PROMMA_CONFIG_DIR;
    if (!existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true });
      } catch (error) {
        console.warn(`无法创建自定义配置目录: ${dir}, 将使用默认目录`);
        // 失败时回退到默认目录
      }
    }
    if (existsSync(dir)) return dir;
  }
  
  // 2. 使用默认目录
  const defaultDir = join(homedir(), '.promma');
  if (!existsSync(defaultDir)) {
    try {
      mkdirSync(defaultDir, { recursive: true });
    } catch (error) {
      console.error('无法创建配置目录:', error);
      // 如果创建默认目录失败，使用当前目录
      return '.';
    }
  }
  return defaultDir;
}

// 获取API密钥，优先从环境变量获取，如果没有则尝试从配置文件获取
export const getApiKey = (): string => {
  // 1. 从环境变量获取
  const envApiKey = process.env.GEMINI_API_KEY;
  if (envApiKey) {
    return envApiKey;
  }

  // 2. 尝试从配置文件获取
  const configDir = getConfigDir();
  const configFile = join(configDir, 'config.json');
  
  try {
    if (existsSync(configFile)) {
      const config = JSON.parse(readFileSync(configFile, 'utf-8'));
      if (config.apiKey) {
        return config.apiKey;
      }
    }
  } catch (error) {
    console.error('读取配置文件失败:', error);
  }

  return '';
};

// 保存API密钥到配置文件
export const saveApiKey = (apiKey: string): boolean => {
  try {
    const configDir = getConfigDir();
    const configFile = join(configDir, 'config.json');
    
    let config = {};
    if (existsSync(configFile)) {
      try {
        config = JSON.parse(readFileSync(configFile, 'utf-8'));
      } catch (error) {
        console.warn('读取现有配置文件失败，将创建新配置文件');
      }
    }
    
    const updatedConfig = { ...config, apiKey };
    
    writeFileSync(configFile, JSON.stringify(updatedConfig, null, 2));
    
    // 同时设置到环境变量中
    process.env.GEMINI_API_KEY = apiKey;
    
    return true;
  } catch (error) {
    console.error('保存API密钥失败:', error);
    return false;
  }
};

// 响应结构
export interface PromptResponse {
  title: string;
  description: string;
  content: string;
  tags: string[];
}

export interface GeminiResponse {
  structured?: PromptResponse;
  text: string;
  error?: string;
}

/**
 * 检查并提示用户设置API密钥
 * @returns {Promise<boolean>} 如果API密钥存在或成功设置，则返回true，否则返回false。
 */
export async function ensureApiKey(): Promise<boolean> {
  let apiKey = getApiKey();

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
      return false;
    }

    const { apiKey: userApiKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: '请输入您的Gemini API密钥:',
        validate: (input) => {
          if (!input) return '密钥不能为空';
          return true; // No validation, just check if not empty
        }
      }
    ]);

    const success = saveApiKey(userApiKey);

    if (success) {
      console.log(chalk.green('API密钥已成功保存！'));
      apiKey = userApiKey; // Update apiKey after successful save
    } else {
      console.log(chalk.red('保存API密钥失败，请稍后再试'));
      return false;
    }
  }

  // 如果到这里apiKey仍然不存在，则返回false
  return !!apiKey;
}

export const geminiService = {
  /**
   * 生成结构化提示词
   * @param userInput 用户输入
   * @returns 生成的结构化提示词
   */
  async generateStructuredPrompt(userInput: string): Promise<GeminiResponse> {
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        return {
          text: '',
          error: '未设置GEMINI_API_KEY。请使用 "promma config" 设置API密钥。'
        };
      }

      // 初始化Google AI实例
      const genAI = new GoogleGenerativeAI(apiKey);
      
      // 获取模型
      const model = genAI.getGenerativeModel({
        model: MODEL_NAME
      });

      // 创建内容
      const contents = [
        {
          role: 'user',
          parts: [{ 
            text: `你是一个提示词生成助手。需要生成结构化的提示词，包含标题、描述、内容和标签。
            
我需要你根据用户的描述生成一个结构化的提示词。结构应该包含：
1. 标题（title）：简洁明了，反映提示词的核心目的
2. 描述（description）：简短描述提示词的用途和效果
3. 内容（content）：详细的提示词内容
4. 标签（tags）：3-5个相关标签，用逗号分隔

请用JSON格式返回，结构如下：
{
  "title": "提示词标题",
  "description": "提示词的简短描述",
  "content": "详细的提示词内容",
  "tags": ["标签1", "标签2", "标签3"]
}

以下是用户的描述：
${userInput}` 
          }]
        }
      ];
      
      // 配置
      const generationConfig: GenerationConfig = {
        temperature: 0.2,
        topP: 0.9,
        topK: 16,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING },
            description: { type: SchemaType.STRING },
            content: { type: SchemaType.STRING },
            tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
          },
          required: ["title", "description", "content", "tags"]
        },
      };

      // 生成内容
      const result = await model.generateContent({
        contents,
        generationConfig
      });

      const responseText = result.response.text();

      // 尝试解析为JSON
      try {
        const structured = JSON.parse(responseText) as PromptResponse;
        return { 
          structured,
          text: responseText 
        };
      } catch (error) {
        return { 
          text: responseText,
          error: '无法解析为结构化数据'
        };
      }
    } catch (error) {
      return {
        text: '',
        error: `调用Gemini API失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },
  
  /**
   * 生成提示词（兼容旧接口）
   * @param userInput 用户输入
   * @returns 生成的提示词
   */
  async generatePrompt(userInput: string): Promise<GeminiResponse> {
    return this.generateStructuredPrompt(userInput);
  }
};
