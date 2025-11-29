"""
Browser bookmarklet generator for ACM-Compass
Reads JavaScript from bookmarklet.js and generates an HTML page
"""
from pathlib import Path
import re


def load_bookmarklet_js():
    """Load JavaScript from bookmarklet.js file"""
    js_file = Path(__file__).parent / "bookmarklet.js"
    if not js_file.exists():
        raise FileNotFoundError(f"bookmarklet.js not found at {js_file}")

    return js_file.read_text(encoding='utf-8')


def generate_bookmarklet_html():
    """Generate an HTML page with the bookmarklet"""
    # Load JavaScript from file
    js_code = load_bookmarklet_js()

    # Minify the JavaScript more carefully
    # Remove single-line comments (but preserve URLs)
    js = re.sub(r'(?<!:)//(?!/)[^\n]*', '', js_code)  # Don't remove // in URLs
    # Remove multi-line comments
    js = re.sub(r'/\*.*?\*/', '', js, flags=re.DOTALL)
    # Compress whitespace
    js = re.sub(r'\s+', ' ', js)
    # Remove spaces around operators (but be careful)
    js = re.sub(r'\s*([{}();,=<>!+\-*/&|])\s*', r'\1', js)
    # Replace all double quotes with single quotes (for consistency)
    js = js.replace('"', "'")
    js = js.strip()

    # No need to escape - we'll use double quotes for href attribute
    # JavaScript code can safely use single quotes inside
    bookmarklet_url = f"javascript:{js}"

    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ACM-Compass 浏览器助手</title>
    <style>
        body {{
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 900px;
            margin: 50px auto;
            padding: 20px;
            line-height: 1.6;
            background: #f9f9f9;
        }}
        .container {{
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        h1 {{
            color: #2c3e50;
            border-bottom: 3px solid #4CAF50;
            padding-bottom: 10px;
        }}
        h2 {{
            color: #34495e;
            margin-top: 30px;
        }}
        .bookmarklet-box {{
            text-align: center;
            padding: 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            margin: 30px 0;
        }}
        .bookmarklet {{
            display: inline-block;
            padding: 15px 30px;
            background: #4CAF50;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-size: 18px;
            font-weight: bold;
            cursor: move;
            box-shadow: 0 4px 6px rgba(0,0,0,0.2);
            transition: all 0.3s;
        }}
        .bookmarklet:hover {{
            background: #45a049;
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(0,0,0,0.3);
        }}
        .instruction {{
            color: white;
            margin-top: 15px;
            font-size: 14px;
        }}
        .step {{
            margin: 20px 0;
            padding: 20px;
            background: #f8f9fa;
            border-left: 4px solid #4CAF50;
            border-radius: 4px;
        }}
        .step strong {{
            color: #2c3e50;
            font-size: 16px;
        }}
        code {{
            background: #e8f5e9;
            padding: 3px 8px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            color: #2e7d32;
            font-size: 14px;
        }}
        .warning {{
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }}
        ul {{
            line-height: 2;
        }}
        .feature-list li::before {{
            content: "✅ ";
            margin-right: 8px;
        }}
        .feature-list {{
            list-style: none;
            padding-left: 0;
        }}
        .troubleshoot li {{
            margin: 10px 0;
        }}
        .footer {{
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 14px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🧭 ACM-Compass 浏览器助手</h1>

        <p style="font-size: 16px;">这个工具可以帮你从 <strong>qoj.ac</strong> 或 <strong>ucup.ac</strong> 的比赛页面快速导入数据到 ACM-Compass。</p>

        <div class="warning">
            <strong>⚠️ 为什么需要书签工具？</strong><br>
            由于 qoj.ac 和 ucup.ac 使用了 Cloudflare 反爬虫保护，传统的自动化工具无法直接访问。
            书签工具在你<strong>已登录的真实浏览器</strong>中运行 JavaScript 提取数据，完美绕过检测。
        </div>

        <h2>📥 第一步：安装书签</h2>

        <div class="bookmarklet-box">
            <div style="font-size: 16px; color: white; margin-bottom: 15px;">
                👇 <strong>将下面的按钮拖拽到浏览器书签栏</strong> 👇
            </div>
            <a class="bookmarklet" href="{bookmarklet_url}">📊 导入比赛数据</a>
            <div class="instruction">
                💡 如何显示书签栏？<br>
                Mac: <code>Cmd+Shift+B</code> | Windows: <code>Ctrl+Shift+B</code>
            </div>
        </div>

        <h2>🚀 第二步：使用书签</h2>

        <div class="step">
            <strong>1️⃣ 启动 ACM-Compass 服务器</strong><br>
            在终端运行：<code>uv run python server.py</code><br>
            访问：<a href="http://127.0.0.1:7860" target="_blank">http://127.0.0.1:7860</a>
        </div>

        <div class="step">
            <strong>2️⃣ 登录并访问比赛 standings 页面</strong><br>
            例如：<code>https://qoj.ac/contest/2513/standings</code><br>
            ⚠️ <strong>重要：</strong>必须先登录你的账号
        </div>

        <div class="step">
            <strong>3️⃣ 点击书签栏的 "📊 导入比赛数据"</strong><br>
            数据将自动提取并发送到 ACM-Compass
        </div>

        <div class="step">
            <strong>4️⃣ 检查并保存数据</strong><br>
            ACM-Compass 会自动打开，数据已填充到表单<br>
            检查无误后点击 <strong>"💾 保存比赛"</strong>
        </div>

        <h2>✨ 功能特性</h2>
        <ul class="feature-list">
            <li>自动提取比赛名称、题目数量</li>
            <li>自动获取每题通过人数和尝试人数</li>
            <li>自动识别你的做题状态（AC/尝试/未提交）</li>
            <li>自动提取你的排名</li>
            <li>完全绕过 Cloudflare 反爬虫</li>
            <li>无需安装浏览器扩展</li>
        </ul>

        <h2>🔧 常见问题</h2>
        <ul class="troubleshoot">
            <li><strong>提示"发送失败"？</strong><br>
                → 确保服务器正在运行：<code>uv run python server.py</code></li>

            <li><strong>数据不完整？</strong><br>
                → 确保在 standings 页面（URL 包含 <code>/standings</code>）</li>

            <li><strong>无法识别我的账号？</strong><br>
                → 请先登录 qoj.ac 或 ucup.ac</li>

            <li><strong>无法拖拽书签？</strong><br>
                → 按 <code>Cmd+Shift+B</code> 或 <code>Ctrl+Shift+B</code> 显示书签栏</li>
        </ul>

        <h2>🔒 安全说明</h2>
        <ul>
            <li>✅ 所有代码在<strong>你的本地浏览器</strong>中运行</li>
            <li>✅ 数据仅发送到<strong>本地服务器</strong> (127.0.0.1:7860)</li>
            <li>✅ 不会发送任何数据到外部服务器</li>
            <li>✅ 开源透明，可查看 <code>bookmarklet.js</code> 源码</li>
        </ul>

        <div class="footer">
            ACM-Compass | 比赛数据管理工具
        </div>
    </div>
</body>
</html>
"""
    return html


if __name__ == "__main__":
    try:
        html = generate_bookmarklet_html()
        output_file = Path(__file__).parent / "bookmarklet.html"
        output_file.write_text(html, encoding='utf-8')
        print(f"✓ Bookmarklet page generated: {output_file}")
        print("Open this file in a browser to get the bookmarklet!")
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()

