# Vercel部署指南

## 自动数据更新功能

本项目利用Vercel的Cron Jobs功能实现每日自动从Habitica获取数据并更新。

### 工作原理

1. 项目包含一个API路由`/api/update-data`，用于从Habitica API获取数据并保存到静态JSON文件中
2. 通过`vercel.json`配置文件设置了一个每日执行一次的定时任务，自动调用此API路由
3. 当定时任务触发时，API路由会获取最新数据并更新`public/data/`目录下的JSON文件

### 部署步骤

1. 在Vercel上创建新项目，关联到此代码库
2. 在项目设置中添加环境变量：
   - `NEXT_PUBLIC_HABITICA_USER_ID`: 你的Habitica用户ID
   - `NEXT_PUBLIC_HABITICA_API_TOKEN`: 你的Habitica API令牌
3. 确保启用了Vercel Cron Jobs功能（在项目设置中查看）

### 验证自动更新

部署完成后，你可以通过以下方式验证自动更新功能是否正常工作：

1. 手动访问`https://你的域名/api/update-data`，应该返回成功信息
2. 在Vercel仪表板中查看Cron Jobs执行日志
3. 观察网站上的数据是否每天更新

### 时区配置说明

Vercel的Cron Jobs使用UTC时区作为默认时区。当前配置的定时任务时间为：

```
"schedule": "0 16 * * *"  # UTC时间每天16:00
```

这个时间对应北京时间（UTC+8）的次日00:00（午夜12点）。如果你需要根据自己的时区调整执行时间，可以参考以下信息：

- 要计算你的本地时间，将UTC时间加上你的时区偏移量
- 例如：
  - 东八区（北京）：UTC+8
  - 东九区（东京）：UTC+9
  - 西八区（洛杉矶）：UTC-8

你可以根据自己的时区需求，修改`vercel.json`中的`schedule`值。

### 注意事项

- Vercel的免费计划对Cron Jobs有一定限制，请查阅最新的Vercel文档
- 如果需要更频繁的更新，可以调整`vercel.json`中的`schedule`值
- 确保你的Habitica API凭据有效且具有足够的权限