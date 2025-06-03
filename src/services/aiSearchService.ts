import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai';
import { getApiKey } from './geminiService';
import { getAllPrompts } from '../models/promptModel';
import type { Prompt } from '../models/promptModel';
import type { GenerationConfig } from '../types/gemini';

// 默认模型名称
const MODEL_NAME = 'gemini-2.5-flash-preview-05-20';

// 搜索结果接口
interface SearchResult {
  id: number;
  relevance: number;
  reason: string;
}

// 搜索响应接口
interface SearchResponse {
  results: SearchResult[];
}

// 扩展提示词接口，添加相关性分数和原因
interface PromptWithRelevance extends Prompt {
  relevance: number;
  reason: string;
}

/**
 * 使用AI进行语义搜索
 */
export const aiSearchService = {
  /**
   * 根据自然语言查询搜索提示词
   * @param query 用户的自然语言查询
   * @param limit 限制返回结果数量
   * @returns 匹配的提示词及相关度排序
   */
  async searchPrompts(query: string, limit: number = 5): Promise<{prompts: PromptWithRelevance[], error?: string}> {
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        return {
          prompts: [],
          error: '未设置GEMINI_API_KEY。请使用 "promma config" 设置API密钥。'
        };
      }

      // 获取所有提示词
      const allPrompts = getAllPrompts();
      if (allPrompts.length === 0) {
        return { prompts: [], error: '提示词库为空' };
      }

      // 初始化Google AI实例
      const genAI = new GoogleGenerativeAI(apiKey);
      
      // 获取模型
      const model = genAI.getGenerativeModel({
        model: MODEL_NAME
      });

      // 准备提示词数据 - 只包含必要信息以减小token数
      const promptData = allPrompts.map((p: Prompt) => ({
        id: p.id,
        title: p.title,
        description: p.description || '',
        preview: p.content.substring(0, 150), // 只取内容的前150个字符
        category: p.category || '',
        tags: p.tags || ''
      }));

      // 配置结构化输出
      const generationConfig: GenerationConfig = {
        temperature: 0.2,
        topP: 0.8,
        topK: 16,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            results: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  id: { type: SchemaType.NUMBER },
                  relevance: { type: SchemaType.NUMBER },
                  reason: { type: SchemaType.STRING }
                },
                required: ["id", "relevance", "reason"]
              }
            }
          },
          required: ["results"]
        },
      };

      // 生成内容
      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [{
            text: `你是一个提示词搜索助手。根据用户的查询，从提供的提示词库中找出最相关的结果。
请根据语义相关性进行匹配，而不仅仅是关键词匹配。考虑提示词的标题、描述、内容预览、分类和标签等所有信息。

提示词库:
${JSON.stringify(promptData)}

请返回相关性大于0.5的结果，最多返回${limit}个，按相关性从高到低排序。
每个结果包含id（提示词ID）、relevance（0-1之间的相关性分数）和reason（简短解释为什么相关）。
用户查询: "${query}"
`
          }]
        }],
        generationConfig
      });

      const responseText = result.response.text();
      
      try {
        // 解析为结构化数据
        const searchResponse = JSON.parse(responseText) as SearchResponse;
        
        if (!searchResponse.results || !Array.isArray(searchResponse.results)) {
          return { prompts: [], error: '搜索结果格式错误' };
        }
        
        // 根据AI返回的ID获取完整的提示词信息
        const matchedPrompts = searchResponse.results
          .map((item: SearchResult) => {
            const prompt = allPrompts.find((p: Prompt) => p.id === item.id);
            if (prompt) {
              return {
                ...prompt,
                relevance: item.relevance,
                reason: item.reason
              } as PromptWithRelevance;
            }
            return null;
          })
          .filter((item): item is PromptWithRelevance => item !== null)
          .sort((a, b) => b.relevance - a.relevance);
        
        return { prompts: matchedPrompts };
      } catch (error) {
        return { prompts: [], error: '解析搜索结果失败' };
      }
    } catch (error) {
      return {
        prompts: [],
        error: `AI搜索失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}; 