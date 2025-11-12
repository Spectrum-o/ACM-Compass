"""
Problems UI module
Handles the problem management tabs (All/Unsolved/Solved)
"""
import gradio as gr
import pandas as pd
from typing import List, Optional

from ..data_manager import (
    load_problems, read_solution, write_solution, delete_solution,
    create_problem, update_problem, delete_problem
)


def problems_to_dataframe(items: List[dict], filter_mode: str = "all") -> pd.DataFrame:
    """Convert problems list to pandas DataFrame"""
    # Filter based on mode
    if filter_mode == "unsolved":
        items = [it for it in items if not it.get('solved')]
    elif filter_mode == "solved":
        items = [it for it in items if it.get('solved')]

    if not items:
        return pd.DataFrame(columns=["ID", "标题", "来源", "状态", "阶段", "补题人", "标签", "通过人数"])

    rows = []
    for it in items:
        status = "✓ 已解决" if it.get('solved') else "⚠ 未解决"
        stage = it.get('unsolved_stage') or '-'
        tags_str = ', '.join(it.get('tags', []))
        rows.append({
            "ID": it.get('id', ''),
            "标题": it.get('title', ''),
            "来源": it.get('source', '-'),
            "状态": status,
            "阶段": stage,
            "补题人": it.get('assignee', '-'),
            "标签": tags_str,
            "通过人数": it.get('pass_count', '-')
        })

    return pd.DataFrame(rows)


def load_problems_ui(filter_mode: str = "all"):
    """Load and display problems"""
    items = load_problems()
    df = problems_to_dataframe(items, filter_mode)
    return df


def save_problem_handler(
    problem_id: str,
    title: str,
    link: str,
    source: str,
    tags: str,
    assignee: str,
    solved: bool,
    unsolved_stage: Optional[str],
    unsolved_custom_label: str,
    pass_count: Optional[int],
    notes: str,
    solution_md: str,
    filter_mode: str
):
    """Save or update a problem"""
    if not title or not title.strip():
        return "❌ 标题不能为空！", load_problems_ui(filter_mode)

    # Parse tags
    tag_list = [t.strip() for t in tags.split(',') if t.strip()] if tags else []

    # Prepare data
    data = {
        'title': title.strip(),
        'link': link.strip() if link else None,
        'source': source.strip() if source else None,
        'tags': tag_list,
        'assignee': assignee.strip() if assignee else None,
        'solved': solved,
        'unsolved_stage': unsolved_stage if not solved else None,
        'unsolved_custom_label': unsolved_custom_label.strip() if unsolved_custom_label and not solved else None,
        'pass_count': pass_count if pass_count is not None and pass_count >= 0 else None,
        'notes': notes.strip() if notes else None,
    }

    if problem_id and problem_id.strip():
        # Update existing
        result = update_problem(problem_id, data)
        if not result:
            return "❌ 未找到该题目！", load_problems_ui(filter_mode)

        # Handle solution
        if solution_md and solution_md.strip():
            write_solution(problem_id, solution_md.strip())
        else:
            delete_solution(problem_id)

        msg = f"✓ 已更新题目: {title}"
    else:
        # Create new
        rec = create_problem(data)
        new_id = rec['id']

        # Handle solution
        if solution_md and solution_md.strip():
            write_solution(new_id, solution_md.strip())

        msg = f"✓ 已添加题目: {title}"

    return msg, load_problems_ui(filter_mode)


def delete_problem_handler(problem_id: str, filter_mode: str):
    """Delete a problem"""
    if not problem_id or not problem_id.strip():
        return "❌ 请先选择要删除的题目！", load_problems_ui(filter_mode)

    success = delete_problem(problem_id)
    if not success:
        return "❌ 未找到该题目！", load_problems_ui(filter_mode)

    return "✓ 已删除题目", load_problems_ui(filter_mode)


def select_problem_handler(evt: gr.SelectData):
    """Handle table row selection"""
    if evt.index[1] != 0:  # If not clicking on ID column
        return [gr.update()] * 12

    problem_id = evt.value
    items = load_problems()

    for it in items:
        if it.get('id') == problem_id:
            tags_str = ', '.join(it.get('tags', []))
            solution = read_solution(problem_id) or ""
            return (
                gr.update(value=problem_id),
                gr.update(value=it.get('title', '')),
                gr.update(value=it.get('link', '')),
                gr.update(value=it.get('source', '')),
                gr.update(value=tags_str),
                gr.update(value=it.get('assignee', '')),
                gr.update(value=it.get('solved', False)),
                gr.update(value=it.get('unsolved_stage')),
                gr.update(value=it.get('unsolved_custom_label', '')),
                gr.update(value=it.get('pass_count')),
                gr.update(value=it.get('notes', '')),
                gr.update(value=solution)
            )

    return [gr.update()] * 12


def clear_form_handler():
    """Clear the problem form"""
    return "", "", "", "", "", "", False, None, "", None, "", ""


def preview_solution_handler(solution_md: str) -> str:
    """Preview solution markdown with LaTeX support"""
    if not solution_md or not solution_md.strip():
        return "*暂无题解内容*"

    # Return markdown directly - Gradio will handle rendering
    return solution_md


def build_problem_tab(title: str, emoji: str, filter_mode: str):
    """Build a problem management tab (All/Unsolved/Solved)"""
    with gr.Tab(f"{emoji} {title}"):
        with gr.Row():
            gr.Markdown(f"### {title}列表")

        filter_state = gr.State(filter_mode)

        with gr.Row():
            refresh_btn = gr.Button("🔄 刷新列表", size="sm")

        problems_table = gr.Dataframe(
            value=load_problems_ui(filter_mode),
            interactive=False,
            wrap=True
        )

        gr.Markdown("### 新增 / 编辑题目")
        gr.Markdown("💡 点击表格中的题目ID可快速加载到编辑表单")

        with gr.Row():
            problem_id = gr.Textbox(label="题目ID（自动生成，编辑时自动填充）", interactive=False, scale=2)
            clear_form_btn = gr.Button("🗑️ 清空表单", size="sm", scale=1)

        with gr.Row():
            title_input = gr.Textbox(label="* 标题", placeholder="CF1234A - Example Problem")
            link_input = gr.Textbox(label="链接", placeholder="https://...")

        with gr.Row():
            source_input = gr.Textbox(label="来源", placeholder="Codeforces / AtCoder / Luogu")
            assignee_input = gr.Textbox(label="当前补题人", placeholder="负责跟进的队员")

        with gr.Row():
            tags_input = gr.Textbox(label="标签（逗号分隔）", placeholder="dp, graph, 数学")
            pass_count_input = gr.Number(label="场上通过人数", value=None, precision=0)

        with gr.Row():
            solved_input = gr.Checkbox(label="已解决", value=False)
            unsolved_stage_input = gr.Dropdown(
                label="未解决阶段",
                choices=["未看题", "已看题无思路", "知道做法未实现"],
                value=None
            )
            unsolved_custom_label_input = gr.Textbox(label="自定义未解决标签", placeholder="例如：卡在调试")

        notes_input = gr.Textbox(label="备注", placeholder="记录思路、坑点等", lines=3)

        gr.Markdown("### 题解（Markdown + LaTeX 支持）")
        gr.Markdown("💡 行内公式：`$公式$`  |  块级公式：`$$公式$$`")
        solution_md_input = gr.Textbox(
            label="题解内容",
            placeholder="支持 Markdown 和 LaTeX 公式\n例如：\n行内公式 $E=mc^2$ 和 $O(n\\log n)$\n\n块级公式：\n$$\n\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\n$$",
            lines=10
        )

        with gr.Row():
            preview_btn = gr.Button("👁️ 预览题解", variant="secondary")
            save_btn = gr.Button("💾 保存", variant="primary")
            delete_btn = gr.Button("🗑️ 删除", variant="stop")

        status_msg = gr.Markdown("")

        with gr.Accordion("题解预览", open=False):
            solution_preview = gr.Markdown(latex_delimiters=[
                {"left": "$", "right": "$", "display": False},
                {"left": "$$", "right": "$$", "display": True}
            ])

        # Event handlers
        refresh_btn.click(
            fn=lambda: load_problems_ui(filter_mode),
            outputs=problems_table
        )

        problems_table.select(
            fn=select_problem_handler,
            outputs=[problem_id, title_input, link_input, source_input, tags_input, assignee_input,
                    solved_input, unsolved_stage_input, unsolved_custom_label_input, pass_count_input,
                    notes_input, solution_md_input]
        )

        clear_form_btn.click(
            fn=clear_form_handler,
            outputs=[problem_id, title_input, link_input, source_input, tags_input, assignee_input,
                    solved_input, unsolved_stage_input, unsolved_custom_label_input, pass_count_input,
                    notes_input, solution_md_input]
        )

        preview_btn.click(
            fn=preview_solution_handler,
            inputs=solution_md_input,
            outputs=solution_preview
        )

        save_btn.click(
            fn=save_problem_handler,
            inputs=[problem_id, title_input, link_input, source_input, tags_input, assignee_input,
                   solved_input, unsolved_stage_input, unsolved_custom_label_input, pass_count_input,
                   notes_input, solution_md_input, filter_state],
            outputs=[status_msg, problems_table]
        )

        delete_btn.click(
            fn=delete_problem_handler,
            inputs=[problem_id, filter_state],
            outputs=[status_msg, problems_table]
        )
