'use client';

interface TaskAnalyticsProps {
  data: Array<{ day: string; value: number }>;
  title: string;
}

interface AnalyticsData {
  completionRate: number;
  longestStreak: number;
  currentStreak: number;
  totalDays: number;
  completedDays: number;
}

const calculateAnalytics = (data: Array<{ day: string; value: number }>): AnalyticsData => {
  // 转换时间戳为本地时区的日期字符串
  const toLocaleDateStr = (timestamp: string | number | Date): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
  };

  // 按日期排序（从旧到新）
  const sortedData = [...data].sort((a, b) => new Date(a.day).getTime() - new Date(b.day).getTime());
  
  // 获取今天的日期（本地时区）
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toLocaleDateStr(today);
  
  // 计算总天数和完成天数
  const earliestDate = new Date(sortedData[0].day);
  const totalDays = Math.floor((today.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const completedDays = sortedData.filter(day => day.value > 0).length;

  // 计算连续天数
  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;

  // 检查今天是否完成
  const todayCompleted = sortedData.some(item => toLocaleDateStr(item.day) === todayStr && item.value > 0);

  // 从今天开始向前计算当前连续天数
  let checkDate = new Date(today);
  let continueStreak = true;

  while (continueStreak) {
    const dateStr = toLocaleDateStr(checkDate);
    const completed = sortedData.some(item => toLocaleDateStr(item.day) === dateStr && item.value > 0);

    if (completed) {
      currentStreak++;
      // 前移一天
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // 如果今天未完成，重置连续天数为0
      if (dateStr === todayStr) {
        currentStreak = 0;
      }
      continueStreak = false;
    }
  }

  // 计算最长连续天数
  let lastDateStr = null;
  for (let i = sortedData.length - 1; i >= 0; i--) {
    const currentDateStr = toLocaleDateStr(sortedData[i].day);

    if (sortedData[i].value > 0) {
      if (!lastDateStr) {
        streak = 1;
      } else {
        // 比较两个日期字符串的差值
        const lastDate = new Date(lastDateStr);
        const currentDate = new Date(currentDateStr);
        const dayDiff = Math.floor((lastDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (dayDiff === 1) {
          streak++;
        } else {
          streak = 1;
        }
      }
      longestStreak = Math.max(longestStreak, streak);
      lastDateStr = currentDateStr;
    } else {
      streak = 0;
      lastDateStr = null;
    }
  }

  return {
    completionRate: (completedDays / totalDays) * 100,
    longestStreak,
    currentStreak,
    totalDays,
    completedDays
  };
};

export default function TaskAnalytics({ data, title }: TaskAnalyticsProps) {
  const analytics = calculateAnalytics(data);

  return (
    <div className="mt-2">
      <div className="grid grid-cols-4 gap-2 bg-white/50 rounded-lg p-2.5">
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-1">Completion Rate</p>
          <p className="text-base font-bold text-primary">
            {analytics.completionRate.toFixed(1)}%
          </p>
        </div>
        <div className="text-center border-x border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Current Streak</p>
          <p className="text-base font-bold text-gray-800">{analytics.currentStreak} days</p>
        </div>
        <div className="text-center border-r border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Longest Streak</p>
          <p className="text-base font-bold text-primary">{analytics.longestStreak} days</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-1">Total Completed</p>
          <p className="text-base font-bold text-gray-800">{analytics.completedDays} days</p>
        </div>
      </div>
    </div>
  );
}