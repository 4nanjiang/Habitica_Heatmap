# Habitica Dailies Heatmap

[![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/your-github-username/habitica-heatmap/fetch-data.yml?branch=main)](https://github.com/your-github-username/habitica-heatmap/actions/workflows/fetch-data.yml)

这个项目展示了您在 Habitica 上每日任务的完成情况热力图。它采用静态生成的方式，在构建时或通过计划任务获取数据，避免在客户端浏览器中暴露您的 Habitica API 凭据。

<img src="https://raw.githubusercontent.com/4nanjiang/Habitica_Heatmap/refs/heads/main/habitica_heatmap.png" alt="habitica_heatmap" width="50%">

## ✨ 特点

-   **静态优先**: 使用 Next.js 构建的静态网站，加载速度快，部署简单。
-   **数据预生成**: 在构建时或通过 GitHub Actions 定时任务从 Habitica API 获取数据，并生成静态 JSON 文件。
-   **安全**: 前端直接从 `/public/data/` 目录下的静态 JSON 文件加载数据，无需在客户端进行 API 调用，保护您的凭据安全。
-   **可视化**: 使用 `@nivo/calendar` 库清晰地展示任务完成热力图。
-   **自动更新**: 通过 GitHub Actions 实现每日自动获取最新数据并部署到 Vercel。

## 🚀 如何工作

项目通过以下步骤运作：

1.  **数据获取**:
    *   **本地/构建时**: 运行 `npm run build` 或 `npm run fetch-data` 时，`scripts/fetch-data.js` 脚本会使用您在 `.env.local` 中配置的 Habitica API 凭据，从 Habitica API 获取任务历史数据。
    *   **自动更新 (GitHub Actions)**: `.github/workflows/fetch-data.yml` 配置了一个 GitHub Actions 工作流，每日定时执行 `scripts/fetch-data.js` 脚本。此工作流使用您在 GitHub Secrets 中配置的凭据。
2.  **数据存储**: 获取到的数据被处理并保存为 JSON 文件，存放于 `public/data/` 目录下。
3.  **静态生成**: Next.js 在构建时读取这些 JSON 文件，生成完全静态的 HTML 页面。
4.  **前端渲染**: 用户访问网站时，浏览器加载静态 HTML 和 JavaScript。JavaScript 从预置的 JSON 数据路径加载数据，并使用 Nivo Calendar 渲染热力图。
5.  **自动部署 (Vercel)**: 当 GitHub Actions 更新数据并推送到仓库后，Vercel 会自动检测到代码变更，触发新的部署，从而更新线上的数据。


## ⚙️ 配置

为了让 GitHub Actions 能够自动获取数据并推送到仓库，您需要在 GitHub 仓库中配置以下 Secrets：

1.  导航到您的 GitHub 仓库 -> Settings -> Secrets and variables -> Actions。
2.  **生成 Personal Access Token (PAT)**:
    *   在 GitHub 页面右上角，点击您的头像，然后选择 "Settings"。
    *   在左侧边栏，向下滚动并点击 "Developer settings"。
    *   在左侧边栏，点击 "Personal access tokens"，然后选择 "Tokens (classic)"。
    *   点击 "Generate new token"，然后选择 "Generate new token (classic)"。
    *   给您的 Token 起一个描述性的名字（例如 `habitica-heatmap-action`）。
    *   在 "Select scopes" 部分，勾选 `repo` 权限。这将允许 Action 推送代码到您的仓库。
    *   点击页面底部的 "Generate token"。
    *   **重要**: 生成后立即复制您的新 PAT。您将无法再次看到它。请将其保存在安全的地方，直到您将其添加到 GitHub Secrets。
3.  点击 "New repository secret" 添加以下三个 Secrets：
    *   `HABITICA_USER_ID`: 您的 Habitica 用户 ID。
    *   `HABITICA_API_TOKEN`: 您的 Habitica API 令牌。
    *   `PAT`: 将您刚刚生成的 GitHub Personal Access Token 粘贴到这里。

## ▶️ 静态部署

## ☁️ Vercel 部署与自动数据更新

本项目已配置好通过 GitHub Actions 实现自动数据更新，并推荐部署在 Vercel 上。

### 部署步骤

1.  **Fork 或克隆此仓库** 到您自己的 GitHub 账户。
2.  **在 Vercel 上创建新项目**，选择您 Fork/克隆的 GitHub 仓库进行关联。Vercel 通常会自动检测到 Next.js 项目并配置好构建设置。
3.  **配置 Vercel 环境变量**:
    * 在 Vercel 控制台中，进入您的项目设置
    * 找到 "Environment Variables" 部分
    * 添加以下环境变量：
      - `HABITICA_USER_ID`: 您的 Habitica 用户 ID
      - `HABITICA_API_TOKEN`: 您的 Habitica API 令牌
    * 这些环境变量用于首次部署时获取初始数据
4.  **配置 GitHub Secrets**: 按照 [配置](#vercel-部署与自动更新) 部分的说明，在您的 GitHub 仓库中设置 `HABITICA_USER_ID`, `HABITICA_API_TOKEN`, 和 `PAT` Secrets。这是自动更新功能正常工作的关键。
5.  **触发首次部署**: Vercel 会在关联仓库后自动进行首次部署。

### 工作原理 (回顾)

-   `.github/workflows/fetch-data.yml` 文件定义了一个 GitHub Actions 工作流。
-   该工作流默认配置为每日定时执行（UTC 时间 16:00，即北京时间次日 00:00）。您可以修改 `.github/workflows/fetch-data.yml` 中的 `cron` 表达式来调整执行时间。
-   工作流运行时，使用您配置的 GitHub Secrets 安全地执行 `scripts/fetch-data.js` 脚本，获取最新 Habitica 数据。
-   脚本将新数据写入 `public/data/` 目录。
-   工作流使用 `PAT` 将包含新数据的更改提交并推送到您的 GitHub 仓库。
-   Vercel 检测到仓库更新，自动触发新的构建和部署流程，将包含最新数据的网站发布上线。

### 验证自动更新

部署完成后，可以通过以下方式验证：

1.  **GitHub Actions 日志**: 在 GitHub 仓库的 "Actions" 标签页查看 "Fetch Habitica Data" 工作流的运行状态和日志。
2.  **Commit 历史**: 检查 `public/data/` 目录下的文件是否有由 GitHub Actions (通常是 `github-actions[bot]`) 定时提交的更新记录。
3.  **Vercel 部署历史**: 查看 Vercel 项目的部署记录，确认是否有由 GitHub Actions 提交触发的自动部署。
4.  **网站数据**: 观察部署后的网站上的热力图数据是否每日更新。

### 时区配置

GitHub Actions 使用 UTC 时区。默认的 `cron` 表达式 `0 16 * * *` 意味着在每天的 16:00 UTC 执行。如果您需要调整，请修改 `.github/workflows/fetch-data.yml` 文件中的 `schedule.cron` 值。

### 注意事项

-   确保您的 Habitica API 凭据和 GitHub PAT 都是有效的，并且 PAT 具有 `repo` 权限。
-   GitHub Actions 的免费额度对于此项目的每日运行通常是足够的，但请关注您的使用情况。

## 🔒 隐私和安全

-   您的 Habitica API 凭据**仅**在本地构建/数据获取时（通过 `.env.local`）或在 GitHub Actions 的安全环境（通过 Secrets）中使用。
-   这些凭据**绝不会**被包含在生成的静态网站文件或暴露给前端浏览器。
-   最终用户访问的网站只包含预先生成的静态数据，不执行任何客户端 API 调用。


**注意：** 本项目的代码由 AI 生成。
