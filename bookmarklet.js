// ACM-Compass 浏览器书签工具
// 用于从 qoj.ac/ucup.ac 的 standings 页面或比赛 Dashboard 页面提取比赛数据

(function() {
    const API_BASE = 'http://127.0.0.1:7860';
    const HOST_PATTERN = '(qoj\\.ac|contest\\.ucup\\.ac|ucup\\.ac)';

    // Check if current URL is supported contest dashboard page (qoj/ucup)
    function isContestDashboard() {
        const url = window.location.href;
        return new RegExp(`^https?:\\/\\/${HOST_PATTERN}\\/contest\\/\\d+\\/?(\\?.*)?$`).test(url);
    }

    // Check if current URL is supported contest standings page
    function isContestStandings() {
        const url = window.location.href;
        return new RegExp(`^https?:\\/\\/${HOST_PATTERN}\\/contest\\/\\d+\\/standings`).test(url);
    }

    // Extract contest ID from URL
    function getContestId() {
        const match = window.location.href.match(/\/contest\/(\d+)/);
        return match ? match[1] : null;
    }

    // Extract problems from contest dashboard page (qoj / ucup)
    function extractDashboardProblems() {
        const problems = [];
        const baseUrl = window.location.origin;

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
            if (link) {
                link = new URL(link, baseUrl).href;
            }

            problems.push({
                letter: letter,
                title: letter + '. ' + title,
                link: link,
                source: source,
                tags: [],
                solved: isSolved,
                unsolved_stage: isSolved ? null : '未看题',
                unsolved_custom_label: null,
                pass_count: null,
                attempt_count: null,
                notes: null
            });
        });

        if (problems.length === 0) {
            alert('未找到任何题目！');
            return null;
        }

        return { problems, source };
    }

    // Extract pass/attempt stats from current standings page DOM
    function extractStandingsStatsFromDOM() {
        const stats = {};

        // Find the standings table
        const table = document.querySelector('table.table-bordered.table-striped');
        if (!table) {
            console.warn('未找到 standings 表格');
            return stats;
        }

        // Get problem headers from thead
        // Structure: <th class="table-success"><div><a>A</a></div><div style="font-size:75%">35/83</div></th>
        const headerRow = table.querySelector('thead tr');
        if (!headerRow) {
            console.warn('未找到表头');
            return stats;
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
            const allDivs = header.querySelectorAll('div');
            let passCount = 0, attemptCount = 0;

            if (allDivs.length >= 2) {
                const statsDiv = allDivs[1];
                const statsText = statsDiv.textContent.trim();
                const match = statsText.match(/(\d+)\s*\/\s*(\d+)/);
                if (match) {
                    passCount = parseInt(match[1]) || 0;
                    attemptCount = parseInt(match[2]) || 0;
                }
            }

            stats[letter] = {
                pass_count: passCount,
                attempt_count: attemptCount
            };
        });

        console.log('从 DOM 提取到统计信息:', stats);
        return stats;
    }

    // Send problems to server for caching (Step 1: Dashboard)
    function sendProblemsToServer(contestId, problemsData) {
        const standingsUrl = `${window.location.origin}/contest/${contestId}/standings`;

        fetch(API_BASE + '/api/import_problems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contestId: contestId,
                source: problemsData.source,
                problems: problemsData.problems
            })
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                alert('✓ 第一步完成！\n\n' + result.message + '\n\n即将跳转到 Standings 页面...\n请在跳转后再次点击书签！');
                window.location.href = standingsUrl;
            } else {
                alert('✗ 缓存题目失败：' + result.message);
            }
        })
        .catch(error => {
            alert('✗ 连接服务器失败，请确保 ACM-Compass 服务器正在运行');
            console.error('Error:', error);
        });
    }

    // Send standings stats to server for merging (Step 2: Standings)
    // 同时发送比赛数据和统计信息
    function sendStandingsToServer(contestId, stats, contestData) {
        // 先发送比赛数据
        fetch(API_BASE + '/api/import_contest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: [contestData] })
        })
        .then(response => response.json())
        .then(() => {
            // 再发送统计信息合并
            return fetch(API_BASE + '/api/import_standings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contestId: contestId,
                    stats: stats
                })
            });
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                alert('✓ 第二步完成！\n\n' + result.message + '\n\n请打开 ACM-Compass 点击「确认导入」按钮完成导入！');
                window.open('http://localhost:3000/', '_blank');
            } else {
                alert('✗ 合并统计失败：' + result.message);
            }
        })
        .catch(error => {
            alert('✗ 连接服务器失败，请确保 ACM-Compass 服务器正在运行');
            console.error('Error:', error);
        });
    }

    // Extract contest data from the current page (standings page) - original logic
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
            const allDivs = header.querySelectorAll('div');
            let passCount = 0, attemptCount = 0;

            if (allDivs.length >= 2) {
                const statsDiv = allDivs[1];
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
                my_status: 'unsubmitted'
            });
        });

        data.total_problems = data.problems.length;

        // Find current user's row (marked with table-warning class)
        const userRow = table.querySelector('tbody tr.table-warning');
        if (userRow) {
            const cells = userRow.querySelectorAll('td');

            if (cells.length > 0) {
                data.user_rank = cells[0].textContent.trim();
            }

            for (let i = 3; i < cells.length && i - 3 < data.problems.length; i++) {
                const cell = cells[i];
                const problemIndex = i - 3;
                const cellText = cell.textContent.trim();

                if (cellText === '') {
                    data.problems[problemIndex].my_status = 'unsubmitted';
                } else {
                    const match = cellText.match(/^([+-]?)(\d*)$/);
                    if (match) {
                        const sign = match[1];
                        if (sign === '-') {
                            data.problems[problemIndex].my_status = 'attempted';
                        } else {
                            data.problems[problemIndex].my_status = 'ac';
                        }
                    } else if (cellText.includes('+')) {
                        data.problems[problemIndex].my_status = 'ac';
                    } else if (cellText.includes('-')) {
                        data.problems[problemIndex].my_status = 'attempted';
                    } else {
                        data.problems[problemIndex].my_status = 'attempted';
                    }
                }
            }
        }

        return data;
    }

    // Send data to local server (original contest import)
    function sendDataToServer(data) {
        fetch(API_BASE + '/api/import_contest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({data: [data]})
        })
        .then(response => response.json())
        .then(result => {
            const apiResult = result.data && result.data[0] ? result.data[0] : result;

            if (apiResult.success) {
                alert('✓ 数据已提取！\n比赛：' + data.name + '\n\n正在打开 ACM-Compass，请点击「加载导入的数据」按钮。');
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

    // Check if there's pending problems for this contest
    async function checkPendingProblems(contestId) {
        try {
            const response = await fetch(API_BASE + '/api/pending_problems');
            const result = await response.json();
            if (result.data && result.data.contestId === contestId) {
                return true;
            }
        } catch (error) {
            console.error('检查缓存失败:', error);
        }
        return false;
    }

    // Main execution
    async function main() {
        const contestId = getContestId();

        if (isContestDashboard()) {
            // Step 1: On Dashboard page - extract problems and send to server
            const problemsData = extractDashboardProblems();
            if (problemsData) {
                console.log('Dashboard: 提取到题目信息:', problemsData);
                sendProblemsToServer(contestId, problemsData);
            }
        } else if (isContestStandings()) {
            // Step 2: On Standings page - check for pending data and send stats
            const hasPending = await checkPendingProblems(contestId);

            if (hasPending) {
                // Has pending data from Dashboard - extract contest and stats, send together
                const contestData = extractContestData();
                const stats = extractStandingsStatsFromDOM();
                console.log('Standings: 提取到比赛数据:', contestData);
                console.log('Standings: 提取到统计信息:', stats);
                if (contestData) {
                    sendStandingsToServer(contestId, stats, contestData);
                }
            } else {
                // No pending data - use original contest import logic (only contest, no problems)
                const contestData = extractContestData();
                if (contestData) {
                    console.log('Extracted contest data:', contestData);
                    sendDataToServer(contestData);
                }
            }
        } else {
            // Other pages - try original standings extraction
            const contestData = extractContestData();
            if (contestData) {
                console.log('Extracted contest data:', contestData);
                sendDataToServer(contestData);
            }
        }
    }

    main();
})();
