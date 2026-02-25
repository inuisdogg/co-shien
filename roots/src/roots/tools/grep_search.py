from crewai.tools import BaseTool
from typing import Type
from pydantic import BaseModel, Field
import os
import re

PROJECT_ROOT = "/Users/inu/Desktop/kidos"

SKIP_DIRS = {'.git', 'node_modules', '.next', '.venv', '__pycache__', '.netlify',
             '.agent_backups', 'roots'}

TEXT_EXTENSIONS = {
    '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.yaml', '.yml',
    '.css', '.html', '.sql', '.py', '.toml', '.txt', '.env', '.sh',
    '.csv', '.xml', '.svg'
}


class GrepSearchInput(BaseModel):
    """Input schema for GrepSearchTool."""
    pattern: str = Field(
        ...,
        description="Search pattern (regex supported). E.g., 'useFacilityData', 'TODO|FIXME', 'interface Child'"
    )
    path: str = Field(
        default="src",
        description="Directory to search in, relative to project root (e.g., 'src', 'src/components')"
    )
    file_pattern: str = Field(
        default="",
        description="Filter by file extension (e.g., '.tsx', '.ts'). Empty = all text files."
    )
    max_results: int = Field(
        default=30,
        description="Maximum number of matching lines to return"
    )


class GrepSearchTool(BaseTool):
    name: str = "Search Code"
    description: str = (
        "Searches for patterns (text or regex) across files in the kidos project. "
        "Returns matching lines with file paths and line numbers. "
        "Useful for finding function definitions, imports, usages, TODOs, etc."
    )
    args_schema: Type[BaseModel] = GrepSearchInput

    def _run(self, pattern: str, path: str = "src", file_pattern: str = "",
             max_results: int = 30) -> str:
        search_path = os.path.join(PROJECT_ROOT, path) if not os.path.isabs(path) else path
        real_path = os.path.realpath(search_path)

        if not real_path.startswith(os.path.realpath(PROJECT_ROOT)):
            return f"Error: Access denied. Path must be within {PROJECT_ROOT}"

        if not os.path.exists(real_path):
            return f"Error: Path not found: {path}"

        try:
            regex = re.compile(pattern, re.IGNORECASE)
        except re.error as e:
            return f"Error: Invalid regex pattern: {e}"

        results = []
        files_searched = 0

        for root, dirs, files in os.walk(real_path):
            # Skip excluded directories
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

            for filename in files:
                ext = os.path.splitext(filename)[1].lower()

                if file_pattern and ext != file_pattern:
                    continue
                if not file_pattern and ext not in TEXT_EXTENSIONS:
                    continue

                filepath = os.path.join(root, filename)
                rel_path = os.path.relpath(filepath, PROJECT_ROOT)
                files_searched += 1

                try:
                    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
                        for line_num, line in enumerate(f, 1):
                            if regex.search(line):
                                results.append(f"{rel_path}:{line_num}: {line.rstrip()}")
                                if len(results) >= max_results:
                                    break
                except (IOError, OSError):
                    continue

                if len(results) >= max_results:
                    break
            if len(results) >= max_results:
                break

        header = f"Search: '{pattern}' in {path}/ ({files_searched} files searched)\n"
        header += f"Results: {len(results)} matches\n"
        header += "-" * 60 + "\n"

        if results:
            return header + "\n".join(results)
        else:
            return header + "No matches found."
