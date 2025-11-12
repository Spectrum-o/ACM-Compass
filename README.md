
# ACM 题目与比赛追踪（本地多人共用）

本项目提供一个开箱即用的本地 Web 工具：
- **Gradio Web界面** - 纯Python实现的交互式Web UI
- **数据存储** - 数据保存在 `data/*.json` 文件中
- **Git 同步** - 天然支持多人协作与历史回溯

## 功能亮点

- **题目管理三视图**：全部（All）/ 未解决（Unsolved）/ 已解决（Solved）
- **题解支持**：Markdown 格式题解编辑与预览
- **比赛管理**：A..O 卡片式记录各题通过/尝试人数与本队状态（AC/attempted/unsubmitted），支持赛后总结与排名
- **一键 Git 同步**：网页内填写提交说明并推送（需本地已配置 Git 仓库与远程）
- **纯文件存储**：`data/problems.json` 与 `data/contests.json`，轻量、可读、易合并
- **零外部依赖**：无需数据库；单个 Python 文件即可运行
- **跨平台支持**：Windows/macOS/Linux

## 快速开始

### 1) 安装依赖（需 Python 3.13+）

```bash
# 使用 uv（推荐）
uv sync

# 或使用 pip
pip install gradio pydantic markdown pandas
```

### 2) 启动服务（默认 http://127.0.0.1:7860/）

```bash
# 方式一：直接运行
python server.py

# 方式二：使用 uv
uv run python server.py
```

打开浏览器访问 `http://127.0.0.1:7860/` 即可。

## 界面导航

**5个主要标签页：**

1. **📚 全部题目** - 查看和管理所有题目
2. **⚠️ 未解决** - 专注于未解决的题目
3. **✅ 已解决** - 查看已完成的题目
4. **🏆 比赛管理** - 记录比赛信息和题目统计
5. **🔄 Git 同步** - 拉取/推送数据到远程仓库

## 数据文件

- `data/problems.json`：题目清单
- `data/solutions/*.md`：每道题的题解 Markdown 文件，文件名为题目 `id`.md
- `data/contests.json`：比赛记录（包含各题统计与状态、排名、赛后总结）

把项目放入 Git 仓库，日常流程建议：
1. 开始前在 "Git 同步" 标签页点击"拉取远程更新"
2. 在界面中增删改题目/比赛并保存
3. 在 "Git 同步" 标签页填写提交说明并点击"推送到远程"

## Git 同步（网页内）

在「Git 同步」标签页：
- 点击"拉取远程更新"触发 `git pull origin main`
- 填写提交说明后点击"推送到远程"，会执行：
  - `git add -A` → `git commit -m "..."` → `git push`
- 操作日志会实时显示在界面中

若出现报错如"not_a_git_repo / no_changes / push 失败"，按提示在项目根目录完成 `git init`、`git remote add origin ...` 等配置。

## 数据模型

### Problem
字段：
- `title: str` 题目标题（必填）
- `link: HttpUrl | null` 题目链接
- `source: str | null` 来源（如 Codeforces/AtCoder/Luogu…）
- `tags: string[]` 标签列表
- `assignee: str | null` 当前补题人（负责跟进的队员）
- `solved: bool` 是否已解决（设为 true 时会自动清空 `unsolved_stage` 与 `unsolved_custom_label`）
- `unsolved_stage: "未看题" | "已看题无思路" | "知道做法未实现" | null`
- `unsolved_custom_label: str | null` 自定义的未解决补充标签（仅在未解决时保留）
- `pass_count: int | null` 场上通过人数（越多越简单）
- `notes: str | null` 备注
- `has_solution: bool` 是否已有题解文件（由程序根据 `data/solutions/{id}.md` 推断，只读）
- 系统字段：`id: str`, `created_at: ISO8601`, `updated_at: ISO8601`

兼容性：历史数据中的 `status == "Done"` 会映射为 `solved = true`；旧字段 `owner` 已移除。

### 题解 Solution
- 每个题目可选配套 `data/solutions/{problem_id}.md` 文件，内容为 Markdown
- Web 端在编辑题目时可直接录入题解，保存时会写入对应 `.md` 文件；为空时会删除文件
- 点击"预览题解"可查看渲染效果

### Contest
字段：
- `name: str` 比赛名称
- `total_problems: int (1..15)` 题目数量（最多 15）
- `problems: { letter: 'A'.., pass_count: int, attempt_count: int, my_status: 'ac'|'attempted'|'unsubmitted' }[]`
- `rank_str: string | null` 形如 `a/b` 的排名
- `summary: string | null` 赛后总结
- 系统字段：`id: str`, `created_at: ISO8601`, `updated_at: ISO8601`

## 使用技巧

### 快速编辑
1. 在表格中点击题目/比赛的 **ID** 列，数据会自动加载到编辑表单
2. 修改后点击"保存"按钮
3. 表格会自动刷新

### 题解编辑
1. 在题目表单底部有"题解内容"文本框
2. 支持 Markdown 语法，可以使用代码块、表格等
3. 点击"预览题解"查看渲染效果
4. 保存题目时会自动保存题解到 `data/solutions/{id}.md`

### 比赛管理
1. 设置"题目数量"后，下方会显示对应数量的题目输入框（A-O）
2. 为每道题填写通过人数、尝试人数和本队状态
3. 在"赛后总结"中记录比赛反思和经验

## 目录结构

```
acm-compass/
├─ server.py             # Gradio 应用主文件
├─ pyproject.toml        # 项目依赖配置
├─ uv.lock              # 依赖锁定文件
├─ data/
│  ├─ problems.json      # 题目数据
│  ├─ contests.json      # 比赛数据
│  └─ solutions/         # 题解 Markdown 文件
│     └─ {problem_id}.md
└─ [quickstart scripts]  # 快速启动脚本（可选）
```

## 常见问题（FAQ）

**Q: 可以自定义字段吗？**
A: 可以。修改 `server.py` 中的 Pydantic 模型（`ProblemIn`/`ContestIn`）并在 UI 中添加对应的输入组件即可。

**Q: 怎么导入旧数据？**
A: 直接编辑 `data/problems.json` 或 `data/contests.json` 文件，确保格式与现有数据一致。程序会自动进行兼容性处理。

**Q: 为什么不用数据库？**
A: 小团队 + Git 同步场景下，JSON 文件足够轻量、可读、易合并；未来如需扩展，迁移到 SQLite/PostgreSQL 也很容易。

**Q: 端口怎么改？**
A: 修改 `server.py` 最后的 `app.launch()` 中的 `server_port` 参数。

**Q: Git 推送失败怎么办？**
A: 确认项目根目录已 `git init` 并配置远程（`git remote -v`）；首次推送可能需要设置上游分支；或检查是否确有暂存更改。

## 技术栈

- **框架**: Gradio 5.49+
- **数据验证**: Pydantic 2.11+
- **Markdown 渲染**: markdown 3.7+
- **数据展示**: pandas 2.2+
- **版本控制**: Git（通过 subprocess 调用）

## 与旧版本的区别

本项目已从 FastAPI + HTML/JS 前端重构为纯 Gradio 应用：
- ✅ 数据格式 100% 兼容
- ✅ 所有功能保留（CRUD、筛选、Git 同步、题解编辑）
- ✅ 更易维护（单个 Python 文件）
- ✅ 自动生成 UI（无需手写 HTML/JS/CSS）

备份文件：`server.py.backup`（旧版 FastAPI）、`frontend.backup/`（旧版前端）
