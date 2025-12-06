// ACM-Compass 浏览器书签工具
// 用于从 qoj.ac/ucup.ac 的 standings 页面或比赛 Dashboard 页面提取比赛数据

(function() {
    // Check if current URL is QOJ contest dashboard page (https://qoj.ac/contest/数字)
    function isQOJContestDashboard() {
        const url = window.location.href;
        // Match: https://qoj.ac/contest/数字 (no trailing path like /standings, /submissions, etc.)
        return /^https?:\/\/qoj\.ac\/contest\/\d+\/?(\?.*)?$/.test(url);
    }

    // Extract problems from QOJ contest dashboard page
    function extractQOJDashboardProblems() {
        const problems = [];

        // Get contest name as source
        const titleElement = document.querySelector('.text-center h1');
        const source = titleElement ? titleElement.textContent.trim() : '';

        // Find the problem table in table-responsive
        const tableResponsive = document.querySelector('.table-responsive');
        if (!tableResponsive) {
            alert('未找到题目表格！请确保在比赛 Dashboard 页面上。');
            return null;
        }

        const table = tableResponsive.querySelector('table.table-bordered');
        if (!table) {
            alert('未找到题目表格！');
            return null;
        }

        // Get problem rows from tbody
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 2) return;

            const letterCell = cells[0];
            const titleCell = cells[1];

            // Get problem letter
            const letter = letterCell.textContent.trim();
            if (!letter || letter.length > 2) return; // Skip if not a valid letter

            // Check if solved (has table-success class)
            const isSolved = letterCell.classList.contains('table-success');

            // Get problem title and link
            const linkElement = titleCell.querySelector('a');
            const title = linkElement ? linkElement.textContent.trim() : titleCell.textContent.trim();
            let link = linkElement ? linkElement.getAttribute('href') : null;

            // Convert relative link to absolute
            if (link && !link.startsWith('http')) {
                link = 'https://qoj.ac' + link;
            }

            problems.push({
                title: letter + '. ' + title,
                link: link,
                source: source,
                tags: [],
                solved: isSolved,
                unsolved_stage: isSolved ? null : '未看题',
                unsolved_custom_label: null,
                pass_count: null,
                notes: null
            });
        });

        if (problems.length === 0) {
            alert('未找到任何题目！');
            return null;
        }

        return { problems, source };
    }

    // Save problems directly to local server
    function saveProblemsDirectly(data) {
        const { problems, source } = data;
        let successCount = 0;
        let failCount = 0;
        let solvedCount = 0;

        // Create problems sequentially
        const createNext = (index) => {
            if (index >= problems.length) {
                // All done
                alert('✓ 题目已保存！\\n\\n来源：' + source + '\\n总数：' + problems.length + '\\n已通过：' + solvedCount + ' 题\\n成功：' + successCount + '\\n失败：' + failCount);
                return;
            }

            const problem = problems[index];
            if (problem.solved) solvedCount++;

            fetch('http://127.0.0.1:7860/api/problems', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(problem)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('HTTP error ' + response.status);
                }
                return response.json();
            })
            .then(() => {
                successCount++;
                createNext(index + 1);
            })
            .catch(error => {
                console.error('Error creating problem:', problem.title, error);
                failCount++;
                createNext(index + 1);
            });
        };

        createNext(0);
    }

    // Extract contest data from the current page (standings page)
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

        // Find current user's row (marked with table-warning class)
        // Structure: <tr class="table-warning"><td>rank</td><td>username</td><td>score</td><td>A</td><td>B</td>...</tr>
        const userRow = table.querySelector('tbody tr.table-warning');
        if (userRow) {
            const cells = userRow.querySelectorAll('td');

            // First cell is rank
            if (cells.length > 0) {
                data.user_rank = cells[0].textContent.trim();
            }

            // Cells 3+ are problem statuses (index 0=rank, 1=username, 2=score)
            for (let i = 3; i < cells.length && i - 3 < data.problems.length; i++) {
                const cell = cells[i];
                const problemIndex = i - 3;
                const cellText = cell.textContent.trim();

                if (cellText === '') {
                    // Empty cell = unsubmitted
                    data.problems[problemIndex].my_status = 'unsubmitted';
                } else {
                    // Check for negative number (attempted) or positive/+ (ac)
                    // Examples: "-6" = attempted, "+", "+1", "+3" = ac
                    const match = cellText.match(/^([+-]?)(\d*)$/);
                    if (match) {
                        const sign = match[1];
                        if (sign === '-') {
                            data.problems[problemIndex].my_status = 'attempted';
                        } else {
                            // '+' or '+N' or just a number means AC
                            data.problems[problemIndex].my_status = 'ac';
                        }
                    } else if (cellText.includes('+')) {
                        // Fallback: contains '+' means AC
                        data.problems[problemIndex].my_status = 'ac';
                    } else if (cellText.includes('-')) {
                        // Fallback: contains '-' means attempted
                        data.problems[problemIndex].my_status = 'attempted';
                    } else {
                        // Any other non-empty content = attempted
                        data.problems[problemIndex].my_status = 'attempted';
                    }
                }
            }
        }

        return data;
    }

    // Send data to local server and open the page
    function sendDataToServer(data) {
        // Send to local server API
        fetch('http://127.0.0.1:7860/api/import_contest', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({data: [data]})
        })
        .then(response => response.json())
        .then(result => {
            // API returns data in format: {"data": [...]}
            const apiResult = result.data && result.data[0] ? result.data[0] : result;

            if (apiResult.success) {
                alert('✓ 数据已提取！\\n比赛：' + data.name + '\\n\\n正在打开 ACM-Compass，请点击「加载导入的数据」按钮。');
                // Open the contest tab in a new window
                window.open('http://localhost:3000/', '_blank');
            } else {
                alert('✗ 提取失败：' + (apiResult.message || '未知错误'));
            }
        })
        .catch(error => {
            alert('✗ 连接服务器失败，请确保 ACM-Compass 服务器正在运行 (http://127.0.0.1:7860)');
            console.error('Error:', error);
            console.log('Extracted data:', data);
        });
    }

    // Main execution
    if (isQOJContestDashboard()) {
        // QOJ contest dashboard page - extract problems and save directly
        const problemsData = extractQOJDashboardProblems();
        if (problemsData) {
            console.log('Extracted QOJ dashboard problems:', problemsData);
            saveProblemsDirectly(problemsData);
        }
    } else {
        // Standings page - create contest using original logic
        const contestData = extractContestData();
        if (contestData) {
            console.log('Extracted contest data:', contestData);
            sendDataToServer(contestData);
        }
    }
})();
