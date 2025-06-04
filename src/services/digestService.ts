import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai';
import * as cheerio from 'cheerio';
import { getApiKey } from './geminiService';
import { URL } from 'url';
import { createHistoryEntry } from '../models/contentModel';

const MODEL_NAME = 'gemini-2.5-flash-preview-05-20';

interface DigestResult {
  summary: string;
  url: string;
  foundLinks: string[];
}

export const digestService = {
  async digestUrl(
    initialUrl: string,
    instruction?: string,
    maxDepth: number = 0,
    onProgress?: (message: string) => void // Add progress callback
  ): Promise<{ result?: DigestResult, error?: string }> {
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        return { error: '未设置GEMINI_API_KEY。请使用 "promma config" 设置API密钥。' };
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: MODEL_NAME });

      const visitedUrls = new Set<string>();
      let allContent: string[] = [];
      let allFoundLinks: string[] = [];
      let currentUrl: string = initialUrl;

      // Helper function to crawl and extract content recursively
      const crawlAndExtractContent = async (
        url: string,
        depth: number
      ): Promise<string[]> => {
        if (depth < 0 || visitedUrls.has(url)) {
          return [];
        }

        visitedUrls.add(url);
        onProgress?.(`正在抓取: ${url} (深度: ${maxDepth - depth}/${maxDepth})`);

        let response;
        try {
          response = await fetch(url);
          if (!response.ok) {
            onProgress?.(`警告: 无法抓取 ${url}: ${response.statusText}`);
            return [];
          }
        } catch (fetchError) {
          onProgress?.(`警告: 抓取 ${url} 时出错: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
          return [];
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        let pageContent = '';
        const currentLinks: string[] = [];

        $('p, h1, h2, h3, h4, h5, h6, li, span, div').each((i, el) => { // Include more tags for better content extraction
          const text = $(el).text().trim();
          if (text) {
            pageContent += text + '\n';
          }
        });

        if (pageContent) {
          allContent.push(`## 内容来自: ${url}\n\n${pageContent}`);
        } else {
          onProgress?.(`警告: 未能从 ${url} 中提取有效内容。`);
        }

        $('a').each((i, el) => {
          const href = $(el).attr('href');
          if (href) {
            try {
              const absoluteUrl = new URL(href, url).href;
              const initialDomain = new URL(initialUrl).hostname;
              const linkDomain = new URL(absoluteUrl).hostname;

              if (linkDomain === initialDomain || linkDomain.endsWith('.' + initialDomain)) {
                currentLinks.push(absoluteUrl);
              }
            } catch (e) {
              // Ignore invalid URLs
            }
          }
        });
        
        allFoundLinks = allFoundLinks.concat(currentLinks);

        if (depth > 0) {
          for (const link of currentLinks) {
            if (!visitedUrls.has(link)) {
              await crawlAndExtractContent(link, depth - 1);
            }
          }
        }
        return currentLinks;
      };

      await crawlAndExtractContent(initialUrl, maxDepth);

      if (allContent.length === 0) {
        return { error: '未能从指定URL及其相关链接中提取任何有效内容。' };
      }

      let combinedContent = allContent.join('\n\n---\n\n');

      // Limit total content length to avoid exceeding token limits
      const MAX_TOTAL_CONTENT_LENGTH = 30000; // Increased limit for recursive content
      if (combinedContent.length > MAX_TOTAL_CONTENT_LENGTH) {
        combinedContent = combinedContent.substring(0, MAX_TOTAL_CONTENT_LENGTH) + '\n\n... (内容过长，已截断)';
      }

      // AI summarization prompt
      const basePrompt = `请总结以下网页内容，生成一个简洁明了的Markdown格式摘要。摘要应包含标题、要点列表，并突出关键信息。
网页内容来自: ${initialUrl} 及其相关页面。

---
${combinedContent}
---

请直接输出Markdown格式的总结内容，不要包含任何额外说明或前言。`;

      const finalPrompt = instruction ? `${instruction}\n\n${basePrompt}` : basePrompt;

      const result = await model.generateContent(finalPrompt);
      const summary = result.response.text();

      // Save to history
      await createHistoryEntry({
        url: initialUrl,
        instruction: instruction,
        summary: summary
      });

      return { result: { summary, url: initialUrl, foundLinks: Array.from(new Set(allFoundLinks)) } };

    } catch (error) {
      console.error('文摘功能失败:', error);
      return { error: `文摘功能失败: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
}; 