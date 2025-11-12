"""
Contests UI module
Handles the contest management tab
"""
import gradio as gr
import pandas as pd
from typing import List

from ..data_manager import (
    load_contests, create_contest, update_contest, delete_contest
)
from ..models import LETTERS


def contests_to_dataframe(items: List[dict]) -> pd.DataFrame:
    """Convert contests list to pandas DataFrame"""
    if not items:
        return pd.DataFrame(columns=["ID", "比赛名称", "题目数", "通过数", "排名", "更新时间"])

    rows = []
    for it in items:
        solved_count = sum(1 for p in it.get('problems', []) if p.get('my_status') == 'ac')
        total = it.get('total_problems', 0)
        rows.append({
            "ID": it.get('id', ''),
            "比赛名称": it.get('name', ''),
            "题目数": total,
            "通过数": f"{solved_count}/{total}",
            "排名": it.get('rank_str', '-'),
            "更新时间": it.get('updated_at', '-')
        })

    return pd.DataFrame(rows)


def load_contests_ui():
    """Load and display contests"""
    items = load_contests()
    df = contests_to_dataframe(items)
    return df


def save_contest_handler(
    contest_id: str,
    name: str,
    total_problems: int,
    rank_str: str,
    summary: str,
    *problem_data  # This will be pass/attempt/status for each problem
):
    """Save or update a contest"""
    if not name or not name.strip():
        return "❌ 比赛名称不能为空！", load_contests_ui()

    total_problems = max(1, min(15, total_problems))

    # Parse problem data
    problems = []
    for i in range(total_problems):
        idx = i * 3
        if idx + 2 < len(problem_data):
            problems.append({
                'letter': LETTERS[i],
                'pass_count': int(problem_data[idx]) if problem_data[idx] else 0,
                'attempt_count': int(problem_data[idx + 1]) if problem_data[idx + 1] else 0,
                'my_status': problem_data[idx + 2] or 'unsubmitted'
            })

    data = {
        'name': name.strip(),
        'total_problems': total_problems,
        'problems': problems,
        'rank_str': rank_str.strip() if rank_str else None,
        'summary': summary.strip() if summary else None,
    }

    if contest_id and contest_id.strip():
        # Update existing
        result = update_contest(contest_id, data)
        if not result:
            return "❌ 未找到该比赛！", load_contests_ui()
        msg = f"✓ 已更新比赛: {name}"
    else:
        # Create new
        create_contest(data)
        msg = f"✓ 已添加比赛: {name}"

    return msg, load_contests_ui()


def delete_contest_handler(contest_id: str):
    """Delete a contest"""
    if not contest_id or not contest_id.strip():
        return "❌ 请先选择要删除的比赛！", load_contests_ui()

    success = delete_contest(contest_id)
    if not success:
        return "❌ 未找到该比赛！", load_contests_ui()

    return "✓ 已删除比赛", load_contests_ui()


def select_contest_handler(evt: gr.SelectData):
    """Handle contest table row selection"""
    if evt.index[1] != 0:  # If not clicking on ID column
        return [gr.update()] * 50

    contest_id = evt.value
    items = load_contests()

    for it in items:
        if it.get('id') == contest_id:
            updates = [
                gr.update(value=contest_id),
                gr.update(value=it.get('name', '')),
                gr.update(value=it.get('total_problems', 12)),
                gr.update(value=it.get('rank_str', '')),
                gr.update(value=it.get('summary', ''))
            ]

            # Update problem fields
            problems = it.get('problems', [])
            for i in range(15):
                if i < len(problems):
                    p = problems[i]
                    updates.extend([
                        gr.update(value=p.get('pass_count', 0)),
                        gr.update(value=p.get('attempt_count', 0)),
                        gr.update(value=p.get('my_status', 'unsubmitted'))
                    ])
                else:
                    updates.extend([
                        gr.update(value=0),
                        gr.update(value=0),
                        gr.update(value='unsubmitted')
                    ])

            return updates

    return [gr.update()] * 50


def clear_contest_handler():
    """Clear the contest form"""
    updates = ["", "", 12, "", ""]
    for i in range(15):
        updates.extend([0, 0, "unsubmitted"])
    return updates


def build_contest_tab():
    """Build the contest management tab"""
    with gr.Tab("🏆 比赛管理"):
        with gr.Row():
            gr.Markdown("### 比赛列表")

        with gr.Row():
            refresh_contests_btn = gr.Button("🔄 刷新列表", size="sm")

        contests_table = gr.Dataframe(
            value=load_contests_ui(),
            interactive=False,
            wrap=True
        )

        gr.Markdown("### 新增 / 编辑比赛")
        gr.Markdown("💡 点击表格中的比赛ID可快速加载到编辑表单")

        with gr.Row():
            contest_id = gr.Textbox(label="比赛ID", interactive=False, scale=2)
            clear_contest_btn = gr.Button("🗑️ 清空表单", size="sm", scale=1)

        with gr.Row():
            contest_name = gr.Textbox(label="* 比赛名称", placeholder="例如：Codeforces Round 900")
            contest_total_problems = gr.Number(label="题目数量", value=12, precision=0, minimum=1, maximum=15)

        with gr.Row():
            contest_rank = gr.Textbox(label="排名", placeholder="例如：10/150")

        contest_summary = gr.Textbox(label="赛后总结", placeholder="比赛总结、反思等...", lines=5)

        gr.Markdown("### 题目统计 (A-O)")

        # Create problem input fields dynamically
        problem_inputs = []
        for i in range(15):
            letter = LETTERS[i]
            with gr.Row():
                gr.Markdown(f"**{letter}**")
                p_pass = gr.Number(label=f"{letter} 通过人数", value=0, precision=0, scale=1)
                p_attempt = gr.Number(label=f"{letter} 尝试人数", value=0, precision=0, scale=1)
                p_status = gr.Dropdown(
                    label=f"{letter} 本队状态",
                    choices=["unsubmitted", "attempted", "ac"],
                    value="unsubmitted",
                    scale=1
                )
                problem_inputs.extend([p_pass, p_attempt, p_status])

        with gr.Row():
            save_contest_btn = gr.Button("💾 保存比赛", variant="primary")
            delete_contest_btn = gr.Button("🗑️ 删除比赛", variant="stop")

        contest_status = gr.Markdown("")

        # Event handlers
        refresh_contests_btn.click(
            fn=load_contests_ui,
            outputs=contests_table
        )

        all_contest_inputs = [contest_id, contest_name, contest_total_problems, contest_rank, contest_summary] + problem_inputs

        contests_table.select(
            fn=select_contest_handler,
            outputs=all_contest_inputs
        )

        clear_contest_btn.click(
            fn=clear_contest_handler,
            outputs=all_contest_inputs
        )

        save_contest_btn.click(
            fn=save_contest_handler,
            inputs=all_contest_inputs,
            outputs=[contest_status, contests_table]
        )

        delete_contest_btn.click(
            fn=delete_contest_handler,
            inputs=contest_id,
            outputs=[contest_status, contests_table]
        )
