import './globals.css';

export const metadata = {
  title: 'Habitica Dailies Heatmap',
  description: '可视化展示你的Habitica每日任务完成情况',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  )
}
