from crewai.tools import BaseTool
from typing import Type
from pydantic import BaseModel, Field
import subprocess
import os

PROJECT_ROOT = "/Users/inu/Desktop/kidos"

# Allowed command prefixes for safety
ALLOWED_PREFIXES = [
    'npm run build',
    'npm run lint',
    'npm run dev',
    'npx tsc',
    'npx next',
    'node ',
    'cat ',
    'ls ',
    'wc ',
    'git log',
    'git status',
    'git diff',
    'git show',
]


class ShellRunnerInput(BaseModel):
    """Input schema for ShellRunnerTool."""
    command: str = Field(
        ...,
        description=(
            "Shell command to execute. Limited to safe commands: "
            "npm run build, npm run lint, npx tsc, git log/status/diff, ls, node scripts"
        )
    )
    timeout: int = Field(
        default=120,
        description="Timeout in seconds (max 300)"
    )


class ShellRunnerTool(BaseTool):
    name: str = "Run Shell Command"
    description: str = (
        "Executes safe shell commands in the kidos project directory. "
        "Allowed: npm build/lint, TypeScript compiler checks (npx tsc), "
        "git log/status/diff, ls, node scripts. "
        "Blocked: rm, install, push, destructive operations."
    )
    args_schema: Type[BaseModel] = ShellRunnerInput

    def _run(self, command: str, timeout: int = 120) -> str:
        timeout = min(timeout, 300)

        # Security: validate command
        command_clean = command.strip()
        is_allowed = any(command_clean.startswith(prefix) for prefix in ALLOWED_PREFIXES)

        if not is_allowed:
            return (
                f"Error: Command not allowed: '{command_clean}'\n"
                f"Allowed commands: {', '.join(ALLOWED_PREFIXES)}"
            )

        # Block dangerous patterns
        dangerous = ['rm ', 'rm -', 'rmdir', 'sudo', '> /', 'chmod', 'chown',
                      'install', 'push', '--force', 'reset --hard', 'drop ',
                      'delete ', 'truncate']
        for d in dangerous:
            if d in command_clean.lower():
                return f"Error: Dangerous pattern '{d}' detected in command."

        try:
            result = subprocess.run(
                command_clean,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=PROJECT_ROOT,
                env={**os.environ, 'NODE_ENV': 'production'}
            )

            output = ""
            if result.stdout:
                output += f"STDOUT:\n{result.stdout[:5000]}\n"
            if result.stderr:
                output += f"STDERR:\n{result.stderr[:3000]}\n"
            output += f"\nExit code: {result.returncode}"

            if len(output) > 8000:
                output = output[:8000] + "\n... (output truncated)"

            return output

        except subprocess.TimeoutExpired:
            return f"Error: Command timed out after {timeout} seconds"
        except Exception as e:
            return f"Error executing command: {str(e)}"
