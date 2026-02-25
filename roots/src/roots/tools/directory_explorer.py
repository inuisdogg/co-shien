from crewai.tools import BaseTool
from typing import Type
from pydantic import BaseModel, Field
import os

PROJECT_ROOT = "/Users/inu/Desktop/kidos"


class DirectoryExplorerInput(BaseModel):
    """Input schema for DirectoryExplorerTool."""
    path: str = Field(
        default=".",
        description="Path relative to project root (e.g., 'src/components', 'src/app/api')"
    )
    max_depth: int = Field(
        default=3,
        description="Maximum depth of directory tree to show (1-5)"
    )
    show_files: bool = Field(
        default=True,
        description="Whether to show files or only directories"
    )


class DirectoryExplorerTool(BaseTool):
    name: str = "Explore Directory"
    description: str = (
        "Explores the directory structure of the kidos project. "
        "Shows files and subdirectories in a tree format. "
        "Useful for understanding project structure and finding files."
    )
    args_schema: Type[BaseModel] = DirectoryExplorerInput

    def _run(self, path: str = ".", max_depth: int = 3, show_files: bool = True) -> str:
        if os.path.isabs(path):
            full_path = path
        else:
            full_path = os.path.join(PROJECT_ROOT, path)

        real_path = os.path.realpath(full_path)
        if not real_path.startswith(os.path.realpath(PROJECT_ROOT)):
            return f"Error: Access denied. Path must be within {PROJECT_ROOT}"

        if not os.path.exists(real_path):
            return f"Error: Path not found: {path}"

        if not os.path.isdir(real_path):
            return f"Error: {path} is a file, not a directory."

        max_depth = min(max(max_depth, 1), 5)

        lines = [f"Directory: {path}/"]
        self._tree(real_path, "", max_depth, 0, show_files, lines)

        if len(lines) > 500:
            lines = lines[:500]
            lines.append("... (output truncated at 500 entries)")

        return "\n".join(lines)

    def _tree(self, dir_path: str, prefix: str, max_depth: int, depth: int,
              show_files: bool, lines: list):
        if depth >= max_depth:
            return

        skip_dirs = {'.git', 'node_modules', '.next', '.venv', '__pycache__', '.netlify'}

        try:
            entries = sorted(os.listdir(dir_path))
        except PermissionError:
            lines.append(f"{prefix}[permission denied]")
            return

        dirs = []
        files = []
        for e in entries:
            full = os.path.join(dir_path, e)
            if os.path.isdir(full):
                if e not in skip_dirs:
                    dirs.append(e)
            else:
                files.append(e)

        all_entries = []
        for d in dirs:
            all_entries.append((d, True))
        if show_files:
            for f in files:
                all_entries.append((f, False))

        for i, (name, is_dir) in enumerate(all_entries):
            is_last = i == len(all_entries) - 1
            connector = "└── " if is_last else "├── "
            if is_dir:
                lines.append(f"{prefix}{connector}{name}/")
                extension = "    " if is_last else "│   "
                self._tree(
                    os.path.join(dir_path, name),
                    prefix + extension,
                    max_depth,
                    depth + 1,
                    show_files,
                    lines
                )
            else:
                lines.append(f"{prefix}{connector}{name}")
