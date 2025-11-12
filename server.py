"""
ACM Compass - Main application entry point

A local web-based tool for managing competitive programming problems and contests.
Built with Gradio for interactive UI and Python event handlers.
"""
import gradio as gr

from src.ui.problems import build_problem_tab
from src.ui.contests import build_contest_tab
from src.ui.git_sync import build_git_sync_tab


def build_app():
    """Build the main Gradio application"""
    with gr.Blocks(title="ACM Compass - 题目与比赛追踪", theme=gr.themes.Soft()) as app:
        gr.Markdown("# 🧭 ACM Compass - 题目与比赛追踪系统")
        gr.Markdown("本地多人协作的 ACM 题目与比赛管理工具")

        with gr.Tabs():
            # Problem management tabs
            build_problem_tab("全部题目", "📚", "all")
            build_problem_tab("未解决", "⚠️", "unsolved")
            build_problem_tab("已解决", "✅", "solved")

            # Contest management tab
            build_contest_tab()

            # Git sync tab
            build_git_sync_tab()

        gr.Markdown("---")
        gr.Markdown("💾 数据存储：`data/problems.json` | `data/contests.json` | `data/solutions/*.md`")

    return app


def main():
    """Main entry point"""
    app = build_app()
    app.launch(
        server_name="127.0.0.1",
        server_port=7860,
        share=False,
        show_error=True
    )


if __name__ == "__main__":
    main()
