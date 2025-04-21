'use client';

import { useEffect, useState } from 'react';
import { ResponsiveCalendar } from '@nivo/calendar';
import TaskAnalytics from './components/TaskAnalytics';

interface DailyTask {
  id: string;
  title: string;
  notes: string;
  data: Array<{
    day: string;
    value: number;
  }>;
}

// 转换时间戳为本地时区的日期字符串
const toLocaleDateStr = (timestamp: string | number | Date): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
};

export default function Home() {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        console.log('开始从静态文件加载任务数据...');
        const response = await fetch('/data/dailies.json');
        
        if (!response.ok) {
          throw new Error(`Failed to load data: ${response.status} ${response.statusText}`);
        }
        
        const tasksWithHistory = await response.json();
        console.log('加载的任务数据:', tasksWithHistory);
        
        // 转换时间戳为本地时区的日期格式
        const localizedTasks = tasksWithHistory.map(task => ({
          ...task,
          data: task.data.map(item => ({
            day: toLocaleDateStr(item.day),
            value: item.value
          }))
        }));
        
        setTasks(localizedTasks);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch task data');
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-500">
        {error}
      </div>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold text-primary mb-8">Habitica Dailies Heatmap</h1>
      <div className="grid grid-cols-1 gap-6">
        {tasks.map((task) => (
          <div key={task.id} className="card flex flex-col items-center px-8 py-6">
            <div className="w-full">
              <h2 className="task-title">{task.title}</h2>
              {task.notes && <p className="stats-text mb-4">{task.notes}</p>}
            </div>
            <div className="w-full h-[200px] mb-4">
              <style jsx global>{`
                .nivo-calendar-day {
                  rx: 4px;
                  ry: 4px;
                  transition: all 0.2s ease-in-out;
                }
                .nivo-calendar-day:hover {
                  transform: scale(1.1);
                }
              `}</style>
              <ResponsiveCalendar
                data={task.data}
                from={toLocaleDateStr(new Date(new Date().getFullYear(), 0, 1))}
                to={toLocaleDateStr(new Date())}
                emptyColor="#f0f0f0"
                colors={['#e6f3ff', '#4f46e5']}
                margin={{ top: 20, right: 10, bottom: 20, left: 35 }}
                yearSpacing={40}
                monthBorderColor="#ffffff"
                dayBorderWidth={1}
                dayBorderColor="#ffffff"
                legends={[]}
                monthSpacing={0}
                monthLegendPosition="before"
                monthLegendOffset={10}
                daySpacing={3}
                theme={{
                  labels: {
                    text: {
                      fontSize: 14,
                      fill: '#333333'
                    }
                  },
                  tooltip: {
                    container: {
                      borderRadius: '8px',
                    },
                  }
                }}
                tooltip={({ day, value }) => (
                  <div className="bg-white p-2 shadow-lg rounded-lg border border-gray-200">
                    <strong>{day}</strong>: {value ? 'Completed' : 'Not Completed'}
                  </div>
                )}
              />
            </div>
            <div className="flex justify-center">
              <TaskAnalytics data={task.data} title={task.title} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}