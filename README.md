# 健康集 · 我的健康档案

一个**本地优先**的个人健康管理工具（手机版），把体检报告、化验单、处方、体重血压、身体感受等统一归档，并可接入 AI 给出参考建议。

## 特点

- 📤 **自动归档**：上传 PDF / 图片 / 文字描述，自动识别记录类型（体检 / 化验 / 用药 / 体征 / 症状 / 影像）
- 🔍 **指标抽取**：从化验单图片（OCR）或 PDF 文本中自动识别常见指标（血糖、血脂、血常规、肝肾功能等）及参考范围，标记异常
- 🗄️ **本地存储**：所有数据存在浏览器 IndexedDB，**不上传任何服务器**，可导出 JSON 备份
- 🤖 **AI 助手**：可配置 OpenAI 兼容接口（DeepSeek / 通义千问 / Kimi 等），结合你的档案给出建议

> ⚠️ 本工具仅用于个人健康记录整理，AI 建议不能替代专业医疗诊断，异常指标或持续不适请及时就医。

## 运行方法

无需安装 Node，只需 Python 3：

```bash
python server.py
```

然后浏览器打开 `http://localhost:8000`。

**手机访问**：让手机和电脑连同一个 WiFi，打开终端里打印的「手机访问」地址（形如 `http://192.168.x.x:8000`）。

## 部署到手机（GitHub Pages，无需同一 WiFi）

1. 在 GitHub 新建一个【空】仓库（不要勾选 README）
2. 在本目录打开 PowerShell，执行：
   ```powershell
   .\deploy.ps1 -User 你的GitHub用户名
   ```
3. 按脚本提示，在仓库 Settings → Pages 里选 `Deploy from a branch`、分支 `main`、目录 `/ (root)`，保存
4. 1~2 分钟后，手机浏览器打开 `https://你的用户名.github.io/仓库名/`，即可「添加到主屏幕」

> 部署到 Pages 后，数据存在你手机浏览器里（每台设备独立）。AI 说明见下方。

## 配置 AI（可选）

1. 打开页面 → 底部「我的」→ AI 配置
2. 填写接口地址、模型名、API Key（如 DeepSeek：`https://api.deepseek.com/chat/completions`，模型 `deepseek-chat`）
3. 点「测试连接」确认可用

API Key 只保存在你本地浏览器，不会上传。

AI 有两种连接方式（自动切换）：
- **本地运行**（`python server.py`）：通过本地代理转发，**任意** OpenAI 兼容接口都可用（DeepSeek、通义千问、Kimi 等）；
- **GitHub Pages 直连**：浏览器直接调用接口，需接口支持跨域（CORS），推荐 OpenRouter、SiliconFlow、Groq 等。

## 文件结构

```
index.html        应用入口
styles.css        界面样式
app.js            界面与交互逻辑
store.js          IndexedDB 存储层
parser.js         OCR / PDF 解析 / 指标识别
ai.js             AI 客户端
server.py         本地服务器 + AI 转发
sw.js             Service Worker（离线缓存）
manifest.webmanifest  PWA 清单
```

## 数据备份

「我的」→「导出全部数据（JSON）」可下载备份文件；「导入备份」可恢复。
