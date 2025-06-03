import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai';
import * as cheerio from 'cheerio';
import { getApiKey } from './geminiService';

const MODEL_NAME = 'gemini-2.5-flash-preview-05-20';

interface DigestResult {
  summary: string;
  url: string;
}

export const digestService = {
  async digestUrl(url: string, instruction?: string): Promise<{ result?: DigestResult, error?: string }> {
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        return { error: '未设置GEMINI_API_KEY。请使用 "promma config" 设置API密钥。' };
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: MODEL_NAME });

      // Fetch web content
      const response = await fetch(url);
      if (!response.ok) {
        return { error: `无法获取网页内容: ${response.statusText}` };
      }
      const html = await response.text();

      // Parse HTML to extract main content
      const $ = cheerio.load(html);
      let mainContent = '';
      $('p, h1, h2, h3, h4, h5, h6, li').each((i, el) => {
        const text = $(el).text().trim();
        if (text) {
          mainContent += text + '\n';
        }
      });

      if (!mainContent) {
        return { error: '未能从网页中提取有效内容。' };
      }
      
      // Limit content length to avoid exceeding token limits
      const MAX_CONTENT_LENGTH = 10000; 
      if (mainContent.length > MAX_CONTENT_LENGTH) {
        mainContent = mainContent.substring(0, MAX_CONTENT_LENGTH) + '... (内容过长，已截断)';
      }

      // AI summarization prompt
      const basePrompt = `请总结以下网页内容，生成一个简洁明了的Markdown格式摘要。摘要应包含标题、要点列表，并突出关键信息。
网页内容来自: ${url}

---
${mainContent}
---

请直接输出Markdown格式的总结内容，不要包含任何额外说明或前言。`;

      const finalPrompt = instruction ? `${instruction}\n\n${basePrompt}` : basePrompt;

      const result = await model.generateContent(finalPrompt);
      const summary = result.response.text();

      return { result: { summary, url } };

    } catch (error) {
      console.error('文摘功能失败:', error);
      return { error: `文摘功能失败: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
}; 