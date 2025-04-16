// 构建时获取Habitica数据并生成静态JSON文件
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

// 确保public/data目录存在
const dataDir = path.join(process.cwd(), 'public', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 从habitica.ts导入HabiticaClient类的逻辑
class HabiticaClient {
  constructor(config) {
    this.config = {
      baseUrl: 'https://habitica.com/api/v3',
      retryDelay: 10000,
      maxRetries: 5,
      cacheExpiration: 24 * 60 * 60 * 1000,
      ...config
    };
    this.lastRequestTime = 0;
    this.minRequestInterval = 10000;
    this.requestQueue = Promise.resolve();
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async waitForNextRequest() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      await this.sleep(this.minRequestInterval - timeSinceLastRequest);
    }
    this.lastRequestTime = Date.now();
  }

  async request(endpoint, options = {}, retryCount = 0) {
    return new Promise((resolve, reject) => {
      this.requestQueue = this.requestQueue.then(async () => {
        try {
          await this.waitForNextRequest();
          const result = await this._doRequest(endpoint, options, retryCount);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async _doRequest(endpoint, options = {}, retryCount = 0) {
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

      if (response.status === 429 && retryCount < this.config.maxRetries) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
        const delay = retryAfter * 1000 || this.config.retryDelay * Math.pow(2, retryCount);
        console.log(`Rate limited, retrying after ${delay}ms`);
        await this.sleep(delay);
        return this.request(endpoint, options, retryCount + 1);
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Habitica API error: ${errorData.message || response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      if (retryCount < this.config.maxRetries) {
        const delay = this.config.retryDelay * Math.pow(2, retryCount);
        console.log(`Request failed, retrying after ${delay}ms`);
        await this.sleep(delay);
        return this.request(endpoint, options, retryCount + 1);
      }
      throw error;
    }
  }

  async getDailies() {
    console.log('Fetching dailies from Habitica API...');
    const data = await this.request('/tasks/user?type=dailys');
    
    // 一次性获取所有任务的历史记录，使用批处理避免并发请求过多
    const batchSize = 5;
    const batches = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }

    const tasksWithHistory = [];
    for (const batch of batches) {
      console.log(`Processing batch with ${batch.length} tasks`);
      const batchPromises = batch.map(async (task) => {
        try {
          console.log(`Fetching history for task: ${task.text} (${task._id})`);
          const taskData = await this.request(`/tasks/${task._id}`);
          console.log(`Successfully fetched history for: ${task.text}`);
          return {
            ...task,
            history: (taskData.history || []).map((h) => ({
              completed: h.value > 0,
              isDue: taskData.isDue,
              checklistCompleted: taskData.checklist && taskData.checklist.every(item => item.completed),
              date: h.date
            }))          }
        } catch (error) {
          console.error(`Failed to fetch history for ${task.text} (${task._id}):`, error);
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
        .map(result => result.value);
      
      console.log(`Batch processing complete, successfully fetched ${batchResults.length}/${batch.length} task histories`);
      tasksWithHistory.push(...batchResults);
    }

    return tasksWithHistory;
  }
}

async function fetchAndSaveData() {
  try {
    console.log('Starting data fetch process...');
    
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
    console.log(`Retrieved ${dailies.length} daily tasks`);

    // 转换数据格式为前端所需格式，并对每天的记录进行去重处理
    const tasksWithHistory = dailies.map(daily => {
      // 保留原始的ISO 8601时间戳格式
      const uniqueHistory = (daily.history || []).map(h => ({
        day: h.date,
        value: h.completed ? (h.value || 1) : 0
      }));

      return {
        id: daily._id,
        title: daily.text,
        notes: daily.notes,
        data: uniqueHistory
      };
    });

    // 保存数据到JSON文件
    const dataFilePath = path.join(dataDir, 'dailies.json');
    fs.writeFileSync(dataFilePath, JSON.stringify(tasksWithHistory, null, 2));
    console.log(`Data saved to ${dataFilePath}`);

    // 保存最后更新时间
    const metaFilePath = path.join(dataDir, 'meta.json');
    fs.writeFileSync(metaFilePath, JSON.stringify({
      lastUpdated: new Date().toISOString(),
      taskCount: tasksWithHistory.length
    }, null, 2));
    console.log(`Metadata saved to ${metaFilePath}`);

    console.log('Data fetch process completed successfully!');
  } catch (error) {
    console.error('Error fetching data:', error);
    process.exit(1);
  }
}

fetchAndSaveData();