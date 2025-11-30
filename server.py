"""
ACM Compass - Main application entry point

A local web-based tool for managing competitive programming problems and contests.
Built with Gradio for interactive UI and Python event handlers.
"""
import gradio as gr
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from src.ui.banner import print_banner
from src.ui.problems import build_problem_tab
from src.ui.contests import build_contest_tab, import_contest_from_browser, set_pending_import
from src.ui.git_sync import build_git_sync_tab


# Create FastAPI app with CORS
fastapi_app = FastAPI()
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Direct API endpoint for bookmarklet
@fastapi_app.post("/api/import_contest")
async def api_import_contest(request: Request):
    """API endpoint for browser bookmarklet to send contest data"""
    data = await request.json()
    # Gradio sends data in {"data": [...]} format
    if "data" in data and len(data["data"]) > 0:
        contest_data = data["data"][0]
    else:
        contest_data = data
    result = import_contest_from_browser(contest_data)
    return {"data": [result]}


def build_app():
    """Build the main Gradio application"""
    with gr.Blocks(
        title="ACM Compass - 题目与比赛追踪",
        theme=gr.themes.Soft()
    ) as app:
        gr.Markdown("#ACM Compass - 题目与比赛追踪系统")
        gr.Markdown("本地多人协作的 ACM 题目与比赛管理工具")
        gr.Markdown("及时补题才能有提升")
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
        gr.Markdown("📖 浏览器助手：打开 `bookmarklet.html` 获取浏览器导入工具")

    return app


def main():
    """Main entry point"""
    print_banner()
    app = build_app()

    # Mount Gradio app to FastAPI with CORS support
    gr.mount_gradio_app(fastapi_app, app, path="/")

    import uvicorn
    uvicorn.run(
        fastapi_app,
        host="127.0.0.1",
        port=7860
    )


if __name__ == "__main__":
    main()
