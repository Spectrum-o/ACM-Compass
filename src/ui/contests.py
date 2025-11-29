"""
Contests UI module
Handles the contest management tab
"""
import gradio as gr
import pandas as pd
from typing import List, Dict, Any, Optional

from ..data_manager import (
    load_contests, create_contest, update_contest, delete_contest
)
from ..models import LETTERS


# Temporary storage for imported contest data
_pending_import: Optional[Dict[str, Any]] = None


def set_pending_import(data: Dict[str, Any]):
    """Store imported data for later retrieval"""
    global _pending_import
    _pending_import = data


def get_and_clear_pending_import() -> Optional[Dict[str, Any]]:
    """Get and clear pending import data"""
    global _pending_import
    data = _pending_import
    _pending_import = None
    return data


def import_contest_from_browser(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process contest data sent from browser bookmarklet
    Returns form data to auto-fill the UI

    Args:
        data: Contest data extracted by bookmarklet

    Returns:
        Form data for UI auto-fill
    """
    try:
        # Validate required fields
        if not data.get('name'):
            return {"success": False, "message": "缺少比赛名称"}

        if not data.get('problems'):
            return {"success": False, "message": "缺少题目数据"}

        # Store for pending import
        set_pending_import(data)

        # Prepare form data
        form_data = {
            "success": True,
            "message": f"✓ 已提取比赛数据: {data['name']}，请检查后点击保存",
            "contest_name": data['name'],
            "total_problems": data.get('total_problems', len(data['problems'])),
            "rank_str": data.get('user_rank', ''),
            "problems": data['problems']
        }

        return form_data

    except Exception as e:
        return {
            "success": False,
            "message": f"✗ 数据处理失败: {str(e)}"
        }


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

    total_problems = max(1, min(26, total_problems))

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
    # Order: 5 basic + 78 problem_inputs + 26 problem_rows + 1 title + 1 status = 111
    if evt.index[1] != 0:  # If not clicking on ID column
        return [gr.update()] * 111

    contest_id = evt.value
    items = load_contests()

    for it in items:
        if it.get('id') == contest_id:
            total_problems = it.get('total_problems', 12)
            end_letter = LETTERS[total_problems - 1]
            title = f"### 题目统计 (A-{end_letter})"

            # 5 basic fields
            updates = [
                gr.update(value=contest_id),
                gr.update(value=it.get('name', '')),
                gr.update(value=total_problems),
                gr.update(value=it.get('rank_str', '')),
                gr.update(value=it.get('summary', ''))
            ]

            # 78 problem_inputs (26 × 3)
            problems = it.get('problems', [])
            for i in range(26):
                if i < len(problems):
                    p = problems[i]
                    updates.extend([
                        gr.update(value=p.get('pass_count', 0)),
                        gr.update(value=p.get('attempt_count', 0)),
                        gr.update(value=p.get('my_status', 'unsubmitted')),
                    ])
                else:
                    updates.extend([
                        gr.update(value=0),
                        gr.update(value=0),
                        gr.update(value='unsubmitted'),
                    ])

            # 26 problem_rows (visibility)
            for i in range(26):
                updates.append(gr.update(visible=i < total_problems))

            # Title
            updates.append(title)
            # Status message
            updates.append(f"已加载比赛: {it.get('name', '')}")
            return updates

    return [gr.update()] * 111


def clear_contest_handler():
    """Clear the contest form"""
    # 5 basic fields
    updates = ["", "", 12, "", ""]
    # 78 problem_inputs (26 × 3)
    for i in range(26):
        updates.extend([0, 0, "unsubmitted"])
    # 26 problem_rows (visibility)
    for i in range(26):
        updates.append(gr.update(visible=i < 12))
    # Title
    updates.append("### 题目统计 (A-L)")
    # Status message
    updates.append("")
    return updates


def load_pending_import_handler():
    """Load pending import data into the form"""
    data = get_and_clear_pending_import()
    if not data:
        # No pending data, return no updates
        # Order: 5 basic + 78 problem_inputs + 26 problem_rows + 1 title + 1 status = 111
        return [gr.update()] * 111

    total_problems = data.get('total_problems', len(data.get('problems', [])))
    total_problems = max(1, min(26, int(total_problems)))
    end_letter = LETTERS[total_problems - 1]
    title = f"### 题目统计 (A-{end_letter})"

    # Convert rank to string, handle None
    rank_str = data.get('user_rank', '') or ''
    if rank_str and not isinstance(rank_str, str):
        rank_str = str(rank_str)

    # 5 basic fields
    updates = [
        gr.update(value=""),  # contest_id (new contest)
        gr.update(value=data.get('name', '')),
        gr.update(value=int(total_problems)),
        gr.update(value=rank_str),
        gr.update(value='')  # summary
    ]

    # 78 problem_inputs (26 problems × 3 fields each: pass, attempt, status)
    problems = data.get('problems', [])
    for i in range(26):
        if i < len(problems):
            p = problems[i]
            # Ensure pass_count and attempt_count are integers
            pass_count = p.get('pass_count', 0)
            attempt_count = p.get('attempt_count', 0)
            if isinstance(pass_count, str):
                pass_count = int(pass_count) if pass_count.isdigit() else 0
            if isinstance(attempt_count, str):
                attempt_count = int(attempt_count) if attempt_count.isdigit() else 0

            # Ensure my_status is a valid choice
            my_status = p.get('my_status', 'unsubmitted')
            if my_status not in ['unsubmitted', 'attempted', 'ac']:
                my_status = 'unsubmitted'

            updates.extend([
                gr.update(value=int(pass_count)),
                gr.update(value=int(attempt_count)),
                gr.update(value=my_status),
            ])
        else:
            updates.extend([
                gr.update(value=0),
                gr.update(value=0),
                gr.update(value='unsubmitted'),
            ])

    # 26 problem_rows (visibility)
    for i in range(26):
        updates.append(gr.update(visible=i < total_problems))

    # Add title
    updates.append(title)
    # Add status message
    updates.append(f"✓ 已导入比赛数据: {data.get('name', '')}，请检查后点击保存")

    return updates


def update_problem_rows_visibility(total_problems: int):
    """Update visibility of problem rows based on total_problems"""
    if total_problems is None:
        total_problems = 12
    total_problems = max(1, min(26, int(total_problems)))

    # Update title with dynamic range
    end_letter = LETTERS[total_problems - 1]
    title = f"### 题目统计 (A-{end_letter})"

    # Update row visibility
    visibility_updates = [gr.update(visible=i < total_problems) for i in range(26)]

    return [title] + visibility_updates


def build_contest_tab():
    """Build the contest management tab"""
    with gr.Tab("🏆 比赛管理") as contest_tab:
        gr.Markdown("### 使用浏览器书签导入比赛数据")
        gr.Markdown("💡 打开 `bookmarklet.html` 获取浏览器书签工具，在 qoj.ac/ucup.ac 的 standings 页面点击即可导入")

        with gr.Row():
            load_import_btn = gr.Button("📥 加载导入的数据", variant="primary", size="sm")

        gr.Markdown("---")  # Separator

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
            contest_total_problems = gr.Number(label="题目数量", value=12, precision=0, minimum=1, maximum=26)

        with gr.Row():
            contest_rank = gr.Textbox(label="排名", placeholder="例如：10/150")

        contest_summary = gr.Textbox(label="赛后总结", placeholder="比赛总结、反思等...", lines=5)

        problem_stats_title = gr.Markdown("### 题目统计 (A-L)")  # Default shows 12 problems

        # Create problem input fields dynamically with visibility control
        problem_inputs = []
        problem_rows = []
        for i in range(26):
            letter = LETTERS[i]
            with gr.Row(visible=(i < 12)) as problem_row:  # First 12 visible by default
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
                problem_rows.append(problem_row)

        with gr.Row():
            save_contest_btn = gr.Button("💾 保存比赛", variant="primary")
            delete_contest_btn = gr.Button("🗑️ 删除比赛", variant="stop")

        contest_status = gr.Markdown("")

        # Event handlers
        refresh_contests_btn.click(
            fn=load_contests_ui,
            outputs=contests_table
        )

        # Combine all inputs and outputs (including problem rows for visibility control)
        all_contest_inputs = [contest_id, contest_name, contest_total_problems, contest_rank, contest_summary] + problem_inputs
        all_contest_outputs = all_contest_inputs + problem_rows + [problem_stats_title, contest_status]

        # Load imported data button
        load_import_btn.click(
            fn=load_pending_import_handler,
            outputs=all_contest_outputs
        )

        # Dynamic visibility control for problem rows and title
        contest_total_problems.change(
            fn=update_problem_rows_visibility,
            inputs=contest_total_problems,
            outputs=[problem_stats_title] + problem_rows
        )

        contests_table.select(
            fn=select_contest_handler,
            outputs=all_contest_outputs
        )

        clear_contest_btn.click(
            fn=clear_contest_handler,
            outputs=all_contest_outputs
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
