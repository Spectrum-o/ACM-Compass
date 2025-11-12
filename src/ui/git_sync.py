"""
Git sync UI module
Handles the Git version control tab
"""
import gradio as gr
from datetime import datetime

from ..git_utils import git_pull, git_push


def git_pull_handler():
    """Handle git pull operation"""
    return git_pull()


def git_push_handler(message: str):
    """Handle git push operation"""
    return git_push(message)


def build_git_sync_tab():
    """Build the Git sync tab"""
    with gr.Tab("🔄 Git 同步"):
        gr.Markdown("### Git 版本控制")
        gr.Markdown("通过 Git 同步数据文件，支持多人协作")

        gr.Markdown("#### 拉取远程更新")
        with gr.Row():
            pull_btn = gr.Button("⬇️ Git Pull (拉取远程更新)", variant="secondary", size="lg")

        gr.Markdown("#### 推送本地更改")
        with gr.Row():
            commit_msg = gr.Textbox(
                label="提交说明",
                placeholder="描述本次更改...",
                value=f"update data ({datetime.now().strftime('%Y-%m-%d %H:%M:%S')})"
            )

        with gr.Row():
            push_btn = gr.Button("⬆️ Git Push (推送到远程)", variant="primary", size="lg")

        git_output = gr.Textbox(label="Git 操作日志", lines=15, interactive=False, max_lines=20)

        gr.Markdown("""
        **使用说明：**
        1. 确保项目已初始化 Git 仓库：`git init`
        2. 配置远程仓库：`git remote add origin <URL>`
        3. 开始工作前先点击"拉取远程更新"
        4. 修改数据后填写提交说明，点击"推送到远程"
        5. 团队协作时定期拉取更新，避免冲突
        """)

        # Event handlers
        pull_btn.click(
            fn=git_pull_handler,
            outputs=git_output
        )

        push_btn.click(
            fn=git_push_handler,
            inputs=commit_msg,
            outputs=git_output
        )
