from crewai.tools import BaseTool
from typing import Type
from pydantic import BaseModel, Field
import os

PROJECT_ROOT = "/Users/inu/Desktop/kidos"


class FileReaderInput(BaseModel):
    """Input schema for FileReaderTool."""
    file_path: str = Field(
        ...,
        description="Path relative to project root (e.g., 'src/app/page.tsx') or absolute path within the project"
    )
    max_lines: int = Field(
        default=200,
        description="Maximum number of lines to read. Use 0 for unlimited."
    )


class FileReaderTool(BaseTool):
    name: str = "Read File"
    description: str = (
        "Reads the content of a file in the kidos project. "
        "Provide a path relative to the project root (e.g., 'src/app/page.tsx', 'README.md') "
        "or an absolute path. Returns the file content with line numbers."
    )
    args_schema: Type[BaseModel] = FileReaderInput

    def _run(self, file_path: str, max_lines: int = 200) -> str:
        # Resolve path
        if os.path.isabs(file_path):
            full_path = file_path
        else:
            full_path = os.path.join(PROJECT_ROOT, file_path)

        # Security: ensure path is within project
        real_path = os.path.realpath(full_path)
        if not real_path.startswith(os.path.realpath(PROJECT_ROOT)):
            return f"Error: Access denied. Path must be within {PROJECT_ROOT}"

        if not os.path.exists(real_path):
            return f"Error: File not found: {file_path}"

        if os.path.isdir(real_path):
            return f"Error: {file_path} is a directory. Use the Directory Explorer tool instead."

        try:
            with open(real_path, 'r', encoding='utf-8', errors='replace') as f:
                lines = f.readlines()

            total = len(lines)
            if max_lines > 0:
                lines = lines[:max_lines]

            numbered = []
            for i, line in enumerate(lines, 1):
                numbered.append(f"{i:4d} | {line.rstrip()}")

            result = f"File: {file_path} ({total} lines total)\n"
            result += "-" * 60 + "\n"
            result += "\n".join(numbered)

            if max_lines > 0 and total > max_lines:
                result += f"\n\n... ({total - max_lines} more lines truncated)"

            return result
        except Exception as e:
            return f"Error reading file: {str(e)}"
