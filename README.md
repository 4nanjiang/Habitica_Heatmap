# Habitica Dailies Heatmap

这个项目展示了Habitica每日任务的完成情况热力图，使用静态数据生成方式，避免在客户端暴露API凭据。

## 特点

- 使用Next.js构建的静态网站
- 在构建时获取Habitica数据并生成静态JSON文件
- 前端直接从静态JSON文件加载数据，无需API调用
- 使用@nivo/calendar展示任务完成热力图

## 安装

```bash
npm install
```

## 配置

在项目根目录创建`.env.local`文件，添加以下内容：

```
# Habitica API Credentials
NEXT_PUBLIC_HABITICA_USER_ID="你的Habitica用户ID"
NEXT_PUBLIC_HABITICA_API_TOKEN="你的Habitica API令牌"
```

你可以在Habitica网站的设置->API页面找到这些信息。

## 使用方法

### 开发模式

```bash
npm run dev
```

### 获取最新数据

```bash
npm run fetch-data
```

这个命令会从Habitica API获取最新数据并保存到`public/data/`目录下。

### 构建静态网站

```bash
npm run build
```

构建过程会自动执行数据获取脚本，然后生成静态网站。

### 启动生产服务器

```bash
npm run start
```

## 数据更新

### 本地开发

数据在构建时获取，如果需要更新数据，可以重新运行构建命令或单独运行数据获取脚本。

```bash
npm run fetch-data
```

### Vercel自动更新

本项目支持在Vercel上部署时自动每日更新数据：

1. 项目包含API路由`/api/update-data`，用于获取最新数据
2. 通过`vercel.json`配置了每日定时任务，自动调用此API路由
3. 无需手动操作，数据会每天自动更新

详细部署说明请参考[Vercel部署指南](docs/vercel-deployment.md)。

## 隐私和安全

- API凭据仅在构建时使用，不会包含在生成的静态文件中
- 所有用户访问的都是预先生成的静态数据
- 不需要在客户端进行API调用，避免了凭据泄露风险