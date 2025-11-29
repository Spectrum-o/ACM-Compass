// ACM-Compass 浏览器书签工具
// 用于从 qoj.ac/ucup.ac 的 standings 页面提取比赛数据

(function() {
    // Extract contest data from the current page
    function extractContestData() {
        const data = {
            name: '',
            total_problems: 0,
            problems: [],
            user_rank: null
        };

        // Get contest name from h1
        const titleElement = document.querySelector('.text-center h1');
        if (titleElement) {
            data.name = titleElement.textContent.trim();
        }

        // Find the standings table
        const table = document.querySelector('table.table-bordered.table-striped');
        if (!table) {
            alert('未找到比赛表格！请确保在 standings 页面上。');
            return null;
        }

        // Get problem headers from thead
        // Structure: <th class="table-success"><div><a>A</a></div><div style="font-size:75%">35/83</div></th>
        const headerRow = table.querySelector('thead tr');
        if (!headerRow) {
            alert('未找到表头！');
            return null;
        }

        const allHeaders = headerRow.querySelectorAll('th');
        allHeaders.forEach(header => {
            // Skip non-problem headers (rank, username, score columns)
            if (!header.classList.contains('table-success') && !header.classList.contains('table-danger')) {
                return;
            }

            // Get problem letter from the first div's link
            const firstDiv = header.querySelector('div');
            const link = firstDiv ? firstDiv.querySelector('a') : null;
            const letter = link ? link.textContent.trim() : '';

            if (!letter) return;  // Skip if no letter found

            // Get statistics from the second div (format: "pass/attempt")
            // The second div has style="font-size:75%" and contains "35/83"
            const allDivs = header.querySelectorAll('div');
            let passCount = 0, attemptCount = 0;

            if (allDivs.length >= 2) {
                const statsDiv = allDivs[1];  // Second div contains stats
                const statsText = statsDiv.textContent.trim();
                const match = statsText.match(/(\d+)\s*\/\s*(\d+)/);
                if (match) {
                    passCount = parseInt(match[1]) || 0;
                    attemptCount = parseInt(match[2]) || 0;
                }
            }

            data.problems.push({
                letter: letter,
                pass_count: passCount,
                attempt_count: attemptCount,
                my_status: 'unsubmitted'  // Will be updated below
            });
        });

        data.total_problems = data.problems.length;

        // Find current user's row to get their status
        let username = '';
        const profileLinks = document.querySelectorAll('a.uoj-username');
        for (const link of profileLinks) {
            const href = link.getAttribute('href');
            if (href && href.includes('/user/profile/')) {
                username = href.split('/').pop();
                break;
            }
        }

        if (username) {
            // Find user's row in the table
            const rows = table.querySelectorAll('tbody tr');
            for (const row of rows) {
                const usernameCell = row.querySelector('a.uoj-username');
                if (usernameCell && usernameCell.getAttribute('href').includes(username)) {
                    // Get rank
                    const rankCell = row.querySelector('td:first-child');
                    if (rankCell) {
                        data.user_rank = rankCell.textContent.trim();
                    }

                    // Get problem statuses
                    const problemCells = row.querySelectorAll('td');
                    // Skip first 3 columns (rank, username, score)
                    for (let i = 3; i < problemCells.length && i - 3 < data.problems.length; i++) {
                        const cell = problemCells[i];
                        const problemIndex = i - 3;

                        // Check cell classes or content to determine status
                        if (cell.classList.contains('table-success') ||
                            cell.textContent.includes('+')) {
                            data.problems[problemIndex].my_status = 'ac';
                        } else if (cell.textContent.trim() !== '' &&
                                   cell.textContent.trim() !== '-' &&
                                   !cell.classList.contains('table-success')) {
                            data.problems[problemIndex].my_status = 'attempted';
                        }
                    }
                    break;
                }
            }
        }

        return data;
    }

    // Send data to local server and open the page
    function sendDataToServer(data) {
        // Send to local Gradio server API
        fetch('http://127.0.0.1:7860/api/import_contest', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({data: [data]})
        })
        .then(response => response.json())
        .then(result => {
            // Gradio API returns data in format: {"data": [...]}
            const apiResult = result.data && result.data[0] ? result.data[0] : result;

            if (apiResult.success) {
                alert('✓ 数据已提取！\\n比赛：' + data.name + '\\n\\n正在打开 ACM-Compass，请检查数据后点击保存按钮。');
                // Open the contest tab in a new window
                window.open('http://127.0.0.1:7860/', '_blank');
            } else {
                alert('✗ 提取失败：' + (apiResult.message || '未知错误'));
            }
        })
        .catch(error => {
            alert('✗ 发送失败：' + error.message + '\\n\\n请确保 ACM-Compass 服务器正在运行（http://127.0.0.1:7860）');
            console.error('Error:', error);
            console.log('Extracted data:', data);
        });
    }

    // Main execution
    const contestData = extractContestData();
    if (contestData) {
        console.log('Extracted contest data:', contestData);
        sendDataToServer(contestData);
    }
})();
