import type { Context } from 'hono';
import { promptModel } from '../models/promptModel';
import type { Prompt } from '../models/promptModel';
import { geminiService } from '../services/geminiService';

export const promptController = {
  // 获取所有提示词
  getAll: (c: Context) => {
    try {
      const prompts = promptModel.getAll();
      return c.json({ success: true, prompts });
    } catch (error) {
      console.error('获取提示词失败:', error);
      return c.json({ success: false, error: '获取提示词失败' }, 500);
    }
  },

  // 获取单个提示词
  getById: (c: Context) => {
    try {
      const id = Number(c.req.param('id'));
      if (isNaN(id)) {
        return c.json({ success: false, error: '无效的ID' }, 400);
      }

      const prompt = promptModel.getById(id);
      if (!prompt) {
        return c.json({ success: false, error: '提示词不存在' }, 404);
      }

      return c.json({ success: true, prompt });
    } catch (error) {
      console.error('获取提示词失败:', error);
      return c.json({ success: false, error: '获取提示词失败' }, 500);
    }
  },

  // 创建提示词
  create: async (c: Context) => {
    try {
      const data = await c.req.json();
      
      if (!data.title || !data.content) {
        return c.json({ success: false, error: '标题和内容为必填项' }, 400);
      }

      const promptData: Prompt = {
        title: data.title,
        content: data.content,
        category: data.category || '未分类'
      };

      const id = promptModel.create(promptData);
      return c.json({ success: true, id }, 201);
    } catch (error) {
      console.error('创建提示词失败:', error);
      return c.json({ success: false, error: '创建提示词失败' }, 500);
    }
  },

  // 更新提示词
  update: async (c: Context) => {
    try {
      const id = Number(c.req.param('id'));
      if (isNaN(id)) {
        return c.json({ success: false, error: '无效的ID' }, 400);
      }

      const data = await c.req.json();
      if (!data.title || !data.content) {
        return c.json({ success: false, error: '标题和内容为必填项' }, 400);
      }

      const prompt = promptModel.getById(id);
      if (!prompt) {
        return c.json({ success: false, error: '提示词不存在' }, 404);
      }

      const promptData: Prompt = {
        title: data.title,
        content: data.content,
        category: data.category || prompt.category || '未分类'
      };

      const success = promptModel.update(id, promptData);
      if (!success) {
        return c.json({ success: false, error: '更新提示词失败' }, 500);
      }

      return c.json({ success: true });
    } catch (error) {
      console.error('更新提示词失败:', error);
      return c.json({ success: false, error: '更新提示词失败' }, 500);
    }
  },

  // 删除提示词
  delete: (c: Context) => {
    try {
      const id = Number(c.req.param('id'));
      if (isNaN(id)) {
        return c.json({ success: false, error: '无效的ID' }, 400);
      }

      const prompt = promptModel.getById(id);
      if (!prompt) {
        return c.json({ success: false, error: '提示词不存在' }, 404);
      }

      const success = promptModel.delete(id);
      if (!success) {
        return c.json({ success: false, error: '删除提示词失败' }, 500);
      }

      return c.json({ success: true });
    } catch (error) {
      console.error('删除提示词失败:', error);
      return c.json({ success: false, error: '删除提示词失败' }, 500);
    }
  },

  // 搜索提示词
  search: (c: Context) => {
    try {
      const query = c.req.query('q');
      if (!query) {
        return c.json({ success: false, error: '搜索关键词不能为空' }, 400);
      }

      const prompts = promptModel.search(query);
      return c.json({ success: true, prompts });
    } catch (error) {
      console.error('搜索提示词失败:', error);
      return c.json({ success: false, error: '搜索提示词失败' }, 500);
    }
  },

  // 生成提示词
  generate: async (c: Context) => {
    try {
      const { input } = await c.req.json();
      if (!input) {
        return c.json({ success: false, error: '生成提示词需要输入内容' }, 400);
      }

      const result = await geminiService.generatePrompt(input);
      if (result.error) {
        return c.json({ success: false, error: result.error }, 500);
      }

      return c.json({ success: true, prompt: result.text });
    } catch (error) {
      console.error('生成提示词失败:', error);
      return c.json({ success: false, error: '生成提示词失败' }, 500);
    }
  },

  // 预览提示词
  preview: async (c: Context) => {
    try {
      const { content } = await c.req.json();
      if (!content) {
        return c.json({ success: false, error: '预览提示词需要内容' }, 400);
      }

      // 这里只返回原始内容，前端可以渲染预览效果
      return c.json({ success: true, preview: content });
    } catch (error) {
      console.error('预览提示词失败:', error);
      return c.json({ success: false, error: '预览提示词失败' }, 500);
    }
  }
};
