"""
ASCII art banner for ACM Compass startup
"""


def print_banner():
    """Print ASCII art banner with colors on startup"""
    # ANSI color codes
    CYAN = "\033[96m"
    BLUE = "\033[94m"
    MAGENTA = "\033[95m"
    YELLOW = "\033[93m"
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"

    # ASCII art with shadow effect
    banner = f"""
{DIM}{BLUE}                                                                          {RESET}
{BOLD}{CYAN}     █████╗  ██████╗███╗   ███╗       {MAGENTA} ██████╗ ██████╗ ███╗   ███╗██████╗  █████╗ ███████╗███████╗{RESET}
{BOLD}{CYAN}    ██╔══██╗██╔════╝████╗ ████║       {MAGENTA}██╔════╝██╔═══██╗████╗ ████║██╔══██╗██╔══██╗██╔════╝██╔════╝{RESET}
{BOLD}{CYAN}    ███████║██║     ██╔████╔██║{YELLOW} █████╗{MAGENTA}██║     ██║   ██║██╔████╔██║██████╔╝███████║███████╗███████╗{RESET}
{BOLD}{CYAN}    ██╔══██║██║     ██║╚██╔╝██║{YELLOW} ╚════╝{MAGENTA}██║     ██║   ██║██║╚██╔╝██║██╔═══╝ ██╔══██║╚════██║╚════██║{RESET}
{BOLD}{CYAN}    ██║  ██║╚██████╗██║ ╚═╝ ██║       {MAGENTA}╚██████╗╚██████╔╝██║ ╚═╝ ██║██║     ██║  ██║███████║███████║{RESET}
{BOLD}{CYAN}    ╚═╝  ╚═╝ ╚═════╝╚═╝     ╚═╝       {MAGENTA} ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚═╝  ╚═╝╚══════╝╚══════╝{RESET}
{DIM}{BLUE}                                                                          {RESET}
{DIM}    ─────────────────────────────────────────────────────────────────────────────────{RESET}
{YELLOW}                    🧭 题目与比赛追踪系统 | Problem & Contest Tracker{RESET}
{DIM}    ─────────────────────────────────────────────────────────────────────────────────{RESET}
"""
    print(banner)
