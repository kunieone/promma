import { Database } from 'bun:sqlite';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync } from 'fs';

// 获取历史数据目录，支持自定义配置
export const getHistoryDataDir = (): string => {
  // 1. 优先使用环境变量
  if (process.env.PROMMA_HISTORY_DIR) {
    const dir = process.env.PROMMA_HISTORY_DIR;
    if (!existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true });
      } catch (error) {
        console.warn(`无法创建自定义历史目录: ${dir}, 将使用默认目录`);
      }
    }
    if (existsSync(dir)) return dir;
  }
  
  // 2. 使用默认目录
  const defaultDir = join(homedir(), '.promma', 'history');
  if (!existsSync(defaultDir)) {
    try {
      mkdirSync(defaultDir, { recursive: true });
    } catch (error) {
      console.error('无法创建历史目录:', error);
      return '.';
    }
  }
  return defaultDir;
};

// 确保数据目录存在并获取数据库连接
const getHistoryDatabase = (): Database => {
  const dataDir = getHistoryDataDir();
  const dbPath = join(dataDir, 'history.db');
  
  try {
    const db = new Database(dbPath);
    
    // 创建或更新历史记录表
    db.exec(`
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        instruction TEXT,
        summary TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    return db;
  } catch (error) {
    console.error('历史数据库连接失败:', error);
    throw new Error('无法连接到历史数据库');
  }
};

// 初始化数据库连接
const historyDb = getHistoryDatabase();

export interface HistoryEntry {
  id?: number;
  url: string;
  instruction?: string;
  summary: string;
  created_at?: string;
}

interface LastInsertId {
  id: number;
}

interface Changes {
  changes: number;
}

export const contentModel = {
  // 创建新历史记录
  create: (entry: HistoryEntry): number => {
    try {
      const { url, instruction, summary } = entry;
      const stmt = historyDb.prepare(
        'INSERT INTO history (url, instruction, summary) VALUES (?, ?, ?)'
      );
      stmt.run(
        url,
        instruction || null,
        summary
      );
      const result = historyDb.query('SELECT last_insert_rowid() as id').get() as LastInsertId;
      return result.id;
    } catch (error) {
      console.error('创建历史记录失败:', error);
      throw new Error('创建历史记录失败');
    }
  },

  // 获取所有历史记录
  getAll: (): HistoryEntry[] => {
    try {
      const results = historyDb.query('SELECT * FROM history ORDER BY created_at DESC').all();
      return results as HistoryEntry[];
    } catch (error) {
      console.error('获取历史记录失败:', error);
      return [];
    }
  },

  // 根据ID获取历史记录
  getById: (id: number): HistoryEntry | undefined => {
    try {
      const result = historyDb.query('SELECT * FROM history WHERE id = ?').get(id);
      return result as HistoryEntry | undefined;
    } catch (error) {
      console.error(`获取ID为${id}的历史记录失败:`, error);
      return undefined;
    }
  },

  // 删除历史记录
  delete: (id: number): boolean => {
    try {
      const stmt = historyDb.prepare('DELETE FROM history WHERE id = ?');
      stmt.run(id);
      const result = historyDb.query('SELECT changes() as changes').get() as Changes;
      return result.changes > 0;
    } catch (error) {
      console.error(`删除ID为${id}的历史记录失败:`, error);
      return false;
    }
  },

  // 清空所有历史记录
  clearAll: (): boolean => {
    try {
      historyDb.exec('DELETE FROM history');
      console.log('所有历史记录数据已清空。');
      return true;
    } catch (error) {
      console.error('清空所有历史记录失败:', error);
      return false;
    }
  }
};

// 导出便捷函数
export const createHistoryEntry = contentModel.create;
export const getAllHistoryEntries = contentModel.getAll;
export const getHistoryEntryById = contentModel.getById;
export const deleteHistoryEntry = contentModel.delete;
export const clearAllHistoryEntries = contentModel.clearAll;
