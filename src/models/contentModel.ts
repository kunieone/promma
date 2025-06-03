import { Database } from 'bun:sqlite';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync } from 'fs';

// 获取数据目录，支持自定义配置
export function getHistoryDataDir(): string {
  // 1. 优先使用环境变量
  if (process.env.PROMMA_DATA_DIR) {
    const dir = process.env.PROMMA_DATA_DIR;
    if (!existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true });
      } catch (error) {
        console.warn(`无法创建自定义数据目录: ${dir}, 将使用默认目录`);
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
      console.error('无法创建数据目录:', error);
      // 如果创建默认目录失败，使用当前目录
      return '.';
    }
  }
  return defaultDir;
}

// 确保数据目录存在并获取数据库连接
const getDatabase = (): Database => {
  const dataDir = getHistoryDataDir();
  const dbPath = join(dataDir, 'prompts.db');
  
  try {
    const db = new Database(dbPath);
    
    // 创建或更新提示词表（包含所有最新字段）
    db.exec(`
      CREATE TABLE IF NOT EXISTS prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        content TEXT NOT NULL,
        tags TEXT,
        category TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    return db;
  } catch (error) {
    console.error('数据库连接失败:', error);
    throw new Error('无法连接到数据库');
  }
};

// 初始化数据库连接
const db = getDatabase();

export interface Prompt {
  id?: number;
  title: string;
  description?: string;
  content: string;
  tags?: string;
  category?: string;
  created_at?: string;
  updated_at?: string;
}

// 自定义类型
interface LastInsertId {
  id: number;
}

interface Changes {
  changes: number;
}

export const promptModel = {
  // 获取所有提示词
  getAll: (): Prompt[] => {
    try {
      const results = db.query('SELECT * FROM prompts ORDER BY updated_at DESC').all();
      return results as Prompt[];
    } catch (error) {
      console.error('获取提示词失败:', error);
      return [];
    }
  },

  // 根据ID获取提示词
  getById: (id: number): Prompt | undefined => {
    try {
      const result = db.query('SELECT * FROM prompts WHERE id = ?').get(id);
      return result as Prompt | undefined;
    } catch (error) {
      console.error(`获取ID为${id}的提示词失败:`, error);
      return undefined;
    }
  },

  // 创建新提示词
  create: (prompt: Prompt): number => {
    try {
      const { title, description, content, tags, category } = prompt;
      const stmt = db.prepare(
        'INSERT INTO prompts (title, description, content, tags, category) VALUES (?, ?, ?, ?, ?)'
      );
      stmt.run(
        title, 
        description || '', 
        content, 
        tags || '', 
        category || '未分类'
      );
      const result = db.query('SELECT last_insert_rowid() as id').get() as LastInsertId;
      return result.id;
    } catch (error) {
      console.error('创建提示词失败:', error);
      throw new Error('创建提示词失败');
    }
  },

  // 更新提示词
  update: (id: number, prompt: Prompt): boolean => {
    try {
      const { title, description, content, tags, category } = prompt;
      const stmt = db.prepare(
        'UPDATE prompts SET title = ?, description = ?, content = ?, tags = ?, category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      );
      stmt.run(
        title, 
        description || '', 
        content, 
        tags || '', 
        category || '未分类', 
        id
      );
      const result = db.query('SELECT changes() as changes').get() as Changes;
      return result.changes > 0;
    } catch (error) {
      console.error(`更新ID为${id}的提示词失败:`, error);
      return false;
    }
  },

  // 删除提示词
  delete: (id: number): boolean => {
    try {
      const stmt = db.prepare('DELETE FROM prompts WHERE id = ?');
      stmt.run(id);
      const result = db.query('SELECT changes() as changes').get() as Changes;
      return result.changes > 0;
    } catch (error) {
      console.error(`删除ID为${id}的提示词失败:`, error);
      return false;
    }
  },

  // 清空所有提示词
  clearAll: (): boolean => {
    try {
      db.exec('DELETE FROM prompts');
      // 检查是否删除了记录（虽然 DELETE FROM 不直接返回 changes()，但可以假设成功）
      // 如果需要更严格的检查，可以先查询 count(*)，再删除，再查询 count(*)
      console.log('所有提示词数据已清空。');
      return true;
    } catch (error) {
      console.error('清空所有提示词失败:', error);
      return false;
    }
  },

  // 根据关键词搜索提示词
  search: (keyword: string): Prompt[] => {
    try {
      const results = db.query(
        'SELECT * FROM prompts WHERE title LIKE ? OR description LIKE ? OR content LIKE ? OR tags LIKE ? OR category LIKE ? ORDER BY updated_at DESC'
      ).all(
        `%${keyword}%`, 
        `%${keyword}%`, 
        `%${keyword}%`, 
        `%${keyword}%`, 
        `%${keyword}%`
      );
      return results as Prompt[];
    } catch (error) {
      console.error(`搜索关键词"${keyword}"失败:`, error);
      return [];
    }
  },
  
  // 按分类获取提示词
  getByCategory: (category: string): Prompt[] => {
    try {
      const results = db.query(
        'SELECT * FROM prompts WHERE category = ? ORDER BY updated_at DESC'
      ).all(category);
      return results as Prompt[];
    } catch (error) {
      console.error(`获取分类"${category}"的提示词失败:`, error);
      return [];
    }
  },
  
  // 按标签获取提示词
  getByTag: (tag: string): Prompt[] => {
    try {
      const results = db.query(
        'SELECT * FROM prompts WHERE tags LIKE ? ORDER BY updated_at DESC'
      ).all(`%${tag}%`);
      return results as Prompt[];
    } catch (error) {
      console.error(`获取标签"${tag}"的提示词失败:`, error);
      return [];
    }
  },
  
  // 获取所有分类
  getAllCategories: (): string[] => {
    try {
      const results = db.query(
        'SELECT DISTINCT category FROM prompts ORDER BY category'
      ).all() as { category: string }[];
      return results.map(row => row.category);
    } catch (error) {
      console.error('获取所有分类失败:', error);
      return [];
    }
  },
  
  // 获取所有标签
  getAllTags: (): string[] => {
    try {
      const results = db.query(
        'SELECT tags FROM prompts WHERE tags IS NOT NULL AND tags != ""'
      ).all() as { tags: string }[];
      
      // 处理所有标签，分割、去重
      const tagSet = new Set<string>();
      results.forEach(row => {
        const tagArray = row.tags.split(',').map(tag => tag.trim());
        tagArray.forEach(tag => {
          if (tag) tagSet.add(tag);
        });
      });
      
      return Array.from(tagSet).sort();
    } catch (error) {
      console.error('获取所有标签失败:', error);
      return [];
    }
  }
};
