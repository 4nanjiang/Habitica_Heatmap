interface HabiticaConfig {
  userId: string;
  apiToken: string;
  baseUrl?: string;
  retryDelay?: number;
  maxRetries?: number;
  cacheExpiration?: number; // 缓存过期时间（毫秒）
}

interface HabiticaDaily {
  _id: string;
  text: string;
  notes: string;
  completed: boolean;
  history?: {
    value: number;
    date: string;
  }[];
}

interface HabiticaHistory {
  success: boolean;
  date: string;
}

interface CacheData<T> {
  data: T;
  timestamp: number;
}

export class HabiticaClient {
  private config: HabiticaConfig;
  private lastRequestTime: number = 0;
  private readonly minRequestInterval: number = 10000; // 最小请求间隔（毫秒）
  private requestQueue: Promise<any> = Promise.resolve();
  private cache: Map<string, CacheData<any>> = new Map();
  private batchQueue: Map<string, Promise<any>> = new Map();

  constructor(config: HabiticaConfig) {
    this.config = {
      baseUrl: 'https://habitica.com/api/v3',
      retryDelay: 10000, // 初始重试延迟（毫秒）
      maxRetries: 5, // 最大重试次数
      cacheExpiration: 24 * 60 * 60 * 1000, // 默认缓存24小时
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
      return data.data as T;
    } catch (error) {
      if (retryCount < this.config.maxRetries!) {
        const delay = this.config.retryDelay! * Math.pow(2, retryCount);
        await this.sleep(delay);
        return this.request<T>(endpoint, options, retryCount + 1);
      }
      throw error;
    }
  }

  private isCacheValid<T>(cacheKey: string): boolean {
    const cachedData = this.cache.get(cacheKey);
    if (!cachedData) return false;
    
    const now = Date.now();
    return now - cachedData.timestamp < this.config.cacheExpiration!;
  }

  private getCachedData<T>(cacheKey: string): T | null {
    if (!this.isCacheValid(cacheKey)) {
      this.cache.delete(cacheKey);
      return null;
    }
    return this.cache.get(cacheKey)?.data || null;
  }

  private setCacheData<T>(cacheKey: string, data: T): void {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  async getDailies(): Promise<HabiticaDaily[]> {
    const cacheKey = 'dailies';
    const cachedData = this.getCachedData<HabiticaDaily[]>(cacheKey);
    if (cachedData) return cachedData;

    const data = await this.request<HabiticaDaily[]>('/tasks/user?type=dailys');
    
    // 一次性获取所有任务的历史记录，使用批处理避免并发请求过多
    const batchSize = 5;
    const batches = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }

    const tasksWithHistory = [];
    for (const batch of batches) {
      console.log(`处理批次，包含 ${batch.length} 个任务`);
      const batchPromises = batch.map(async (task) => {
        try {
          console.log(`开始获取任务历史: ${task.text} (${task._id})`);
          const taskData = await this.request<any>(`/tasks/${task._id}`);
          console.log(`成功获取任务历史: ${task.text}`);
          return {
            ...task,
            history: (taskData.history || []).map((h: any) => ({
              completed: h.value > 0,
              date: new Date(h.date).toISOString()
            }))
          };
        } catch (error) {
          console.error(`获取任务历史记录失败 ${task.text} (${task._id}):`, error);
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
        .map(result => (result as PromiseFulfilledResult<HabiticaDaily>).value);
      
      console.log(`批次处理完成，成功获取 ${batchResults.length}/${batch.length} 个任务历史`);
      tasksWithHistory.push(...batchResults);
    }

    this.setCacheData(cacheKey, tasksWithHistory);
    return tasksWithHistory;
  }


}