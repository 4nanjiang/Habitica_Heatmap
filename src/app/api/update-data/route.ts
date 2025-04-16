import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 导入HabiticaClient类的逻辑
interface HabiticaConfig {
  userId: string;
  apiToken: string;
  baseUrl?: string;
  retryDelay?: number;
  maxRetries?: number;
  cacheExpiration?: number;
}

class HabiticaClient {
  private config: HabiticaConfig;
  private lastRequestTime: number = 0;
  private readonly minRequestInterval: number = 10000;
  private requestQueue: Promise<any> = Promise.resolve();

  constructor(config: HabiticaConfig) {
    this.config = {
      baseUrl: 'https://habitica.com/api/v3',
      retryDelay: 10000,
      maxRetries: 5,
      cacheExpiration: 24 * 60 * 60 * 1000,
      ...config
    };
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async waitForNextRequest(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      await this.sleep(this.minRequestInterval - timeSinceLastRequest);
    }
    this.lastRequestTime = Date.now();
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue = this.requestQueue.then(async () => {
        try {
          await this.waitForNextRequest();
          const result = await this._doRequest<T>(endpoint, options, retryCount);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private async _doRequest<T>(endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<T> {
    const headers = {
      'x-api-user': this.config.userId,
      'x-api-key': this.config.apiToken,
      'Content-Type': 'application/json'
    };

    try {
      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          ...headers,
          ...options.headers
        }
      });

      if (response.status === 429 && retryCount < this.config.maxRetries!) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
        const delay = retryAfter * 1000 || this.config.retryDelay! * Math.pow(2, retryCount);
        await this.sleep(delay);
        return this.request<T>(endpoint, options, retryCount + 1);
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Habitica API error: ${errorData.message || response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      if (retryCount < this.config.maxRetries!) {
        const delay = this.config.retryDelay! * Math.pow(2, retryCount);
        await this.sleep(delay);
        return this.request<T>(endpoint, options, retryCount + 1);
      }
      throw error;
    }
  }

  async getDailies() {
    const data = await this.request<any[]>('/tasks/user?type=dailys');
    
    // 一次性获取所有任务的历史记录，使用批处理避免并发请求过多
    const batchSize = 5;
    const batches = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }

    const tasksWithHistory = [];
    for (const batch of batches) {
      const batchPromises = batch.map(async (task) => {
        try {
          const taskData = await this.request<any>(`/tasks/${task._id}`);
          return {
            ...task,
            history: (taskData.history || []).map((h: any) => ({
              completed: h.value > 0,
              date: new Date(h.date).toISOString()
            }))
          };
        } catch (error) {
          // 返回带有空历史记录的任务，而不是失败整个批次
          return {
            ...task,
            history: []
          };
        }
      });
      
      // 使用 Promise.allSettled 替代 Promise.all，确保即使部分请求失败也能继续
      const results = await Promise.allSettled(batchPromises);
      const batchResults = results
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<any>).value);
      
      tasksWithHistory.push(...batchResults);
    }

    return tasksWithHistory;
  }
}

async function fetchAndSaveData() {
  // 确保public/data目录存在
  const dataDir = path.join(process.cwd(), 'public', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // 检查环境变量
  if (!process.env.NEXT_PUBLIC_HABITICA_USER_ID || !process.env.NEXT_PUBLIC_HABITICA_API_TOKEN) {
    throw new Error('环境变量未设置: NEXT_PUBLIC_HABITICA_USER_ID 或 NEXT_PUBLIC_HABITICA_API_TOKEN');
  }

  // 创建Habitica客户端
  const client = new HabiticaClient({
    userId: process.env.NEXT_PUBLIC_HABITICA_USER_ID,
    apiToken: process.env.NEXT_PUBLIC_HABITICA_API_TOKEN
  });

  // 获取任务数据
  const dailies = await client.getDailies();

  // 转换数据格式为前端所需格式
  const tasksWithHistory = dailies.map(daily => ({
    id: daily._id,
    title: daily.text,
    notes: daily.notes,
    data: (daily.history || []).map((h: any) => ({
      day: new Date(h.date).toISOString().split('T')[0],
      value: h.completed ? 1 : 0
    }))
  }));

  // 保存数据到JSON文件
  const dataFilePath = path.join(dataDir, 'dailies.json');
  fs.writeFileSync(dataFilePath, JSON.stringify(tasksWithHistory, null, 2));

  // 保存最后更新时间
  const metaFilePath = path.join(dataDir, 'meta.json');
  fs.writeFileSync(metaFilePath, JSON.stringify({
    lastUpdated: new Date().toISOString(),
    taskCount: tasksWithHistory.length
  }, null, 2));

  return {
    success: true,
    lastUpdated: new Date().toISOString(),
    taskCount: tasksWithHistory.length
  };
}

// API路由处理函数
export async function GET() {
  try {
    const result = await fetchAndSaveData();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating data:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}