// Gemini API 类型定义
import type { Schema } from '@google/generative-ai';

// 生成配置接口
export interface GenerationConfig {
  responseSchema?: Schema;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
} 