import { Hono } from 'hono';
import { promptController } from '../controllers/promptController';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

// 创建提示词路由
const promptRoutes = new Hono();

// 创建提示词验证模式
const promptSchema = z.object({
  title: z.string().min(1, '标题不能为空'),
  content: z.string().min(1, '内容不能为空'),
  category: z.string().optional()
});

// 生成提示词验证模式
const generateSchema = z.object({
  input: z.string().min(1, '输入不能为空')
});

// 预览提示词验证模式
const previewSchema = z.object({
  content: z.string().min(1, '内容不能为空')
});

// 获取所有提示词
promptRoutes.get('/', promptController.getAll);

// 搜索提示词
promptRoutes.get('/search', promptController.search);

// 获取单个提示词
promptRoutes.get('/:id', promptController.getById);

// 创建提示词
promptRoutes.post('/', zValidator('json', promptSchema), promptController.create);

// 更新提示词
promptRoutes.put('/:id', zValidator('json', promptSchema), promptController.update);

// 删除提示词
promptRoutes.delete('/:id', promptController.delete);

// 生成提示词
promptRoutes.post('/generate', zValidator('json', generateSchema), promptController.generate);

// 预览提示词
promptRoutes.post('/preview', zValidator('json', previewSchema), promptController.preview);

export default promptRoutes;
