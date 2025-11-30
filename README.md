<div align="center">

<img src="./docs/banner.svg" alt="ACM-Compass" width="800">

**🧭 题目与比赛追踪系统 | Problem & Contest Tracker**

[![English](https://img.shields.io/badge/English-Documentation-blue)](./docs/README_EN.md)
[![中文文档](https://img.shields.io/badge/中文-文档-green)](./README.md)
[![技术文档](https://img.shields.io/badge/Technical-Documentation-orange)](./docs/tech.md)

</div>

# ACM 题目与比赛追踪

ACM-Compass是一个针对 ACMer 的训练情况进行追踪和记录的工具，用户可以在这里记录自己的训练情况，某场 VP 的训练总结，记录某道题目的坑点，注意事项，题解（支持 LaTeX），帮助大家更好地分析自己队伍的情况，提醒自己需要补的题。

本项目支持私人仓库同步训练数据，可以将自己的训练数据存放到 github 仓库中以防丢失。

主要功能包括题目记录，比赛记录，数据同步等等。

**及时补题才能有提升！！！**

**目前仅支持 qoj 和 ucup。**

## 快速开始

### 安装依赖（需 Python 3.13+）

```bash
# 使用 uv（推荐）
uv sync

# 或使用 pip
pip install -r requirements.txt
```

### 安装书签以自动导入

```bash
# 生成网页
uv run python generate_bookmarklet.py

# 或者直接使用python
python generate_bookmarklet.py
```

### 启动服务（默认 http://127.0.0.1:7860/）

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


## Git 同步（网页内）

在「Git 同步」标签页：
- 点击"拉取远程更新"触发 `git pull origin main`
- 填写提交说明后点击"推送到远程"，会执行：
  - `git add -A` → `git commit -m "..."` → `git push`
- 操作日志会实时显示在界面中

若出现报错如"not_a_git_repo / no_changes / push 失败"，按提示在项目根目录完成 `git init`、`git remote add origin ...` 等配置。


## 使用技巧

### 快速编辑
1. 在表格中点击题目/比赛的 **ID** 列，数据会自动加载到编辑表单
2. 修改后点击"保存"按钮
3. 表格会自动刷新

### 题解编辑
1. 在题目表单底部有"题解内容"文本框
2. 支持 Markdown 语法，可以使用代码块、表格等
3. 点击"预览题解"查看渲染效果

### 比赛管理
1. 设置"题目数量"后，下方会显示对应数量的题目输入框（A-O）
2. 为每道题填写通过人数、尝试人数和本队状态
3. 在"赛后总结"中记录比赛反思和经验

## 贡献

### Issue

如果您发现新的Bug、想要新功能或提出建议，您可以在GitHub上Issue，请按照Issue模板中的准则进行操作。提交问题之前，请确保满足以下条件：

- 必须是错误或新功能。
- 已在问题中不存在类似的问题或解决方案。
- 创建新问题时，请提供详细说明。

### Pull Requests

欢迎大家贡献代码，代码团队将监控所有pull请求，我们将进行相应的代码检查和测试。请在完成PR之前确认以下几点：

- 请在修改代码后修改相应的文档和注释
- 请在新创建的文件中添加许可证和版权声明。
- 进行充分的测试。

## 许可证

本项目采用 GPL-3.0 许可证。详见 [LICENSE](./LICENSE) 文件。

## 👩‍👩‍👧‍👦 Contributors

<div align="center">
<a href="https://github.com/Spectrum-o/ACM-Compass/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Spectrum-o/ACM-Compass&max=400&columns=20" style="width: auto;"/>
</a>
</div>

## 🌟 Star

<div align="center">
  <p>
      <img width="800" src="https://api.star-history.com/svg?repos=Spectrum-o/ACM-Compass&type=Date" alt="Star-history">
  </p>
</div>
