from crewai.tools import BaseTool
from typing import Type
from pydantic import BaseModel, Field
import os
import shutil
from datetime import datetime

PROJECT_ROOT = "/Users/inu/Desktop/kidos"


class FileWriterInput(BaseModel):
    """Input schema for FileWriterTool."""
    file_path: str = Field(
        ...,
        description="Path relative to project root (e.g., 'src/components/NewComponent.tsx')"
    )
    content: str = Field(
        ...,
        description="The full content to write to the file"
    )
    create_backup: bool = Field(
        default=True,
        description="Whether to create a backup of the existing file before overwriting"
    )


class FileWriterTool(BaseTool):
    name: str = "Write File"
    description: str = (
        "Writes content to a file in the kidos project. "
        "Creates parent directories if needed. "
        "Creates a backup of existing files before overwriting. "
        "Use this to create new files or modify existing ones."
    )
    args_schema: Type[BaseModel] = FileWriterInput

    def _run(self, file_path: str, content: str, create_backup: bool = True) -> str:
        # Resolve path
        if os.path.isabs(file_path):
            full_path = file_path
        else:
            full_path = os.path.join(PROJECT_ROOT, file_path)

        # Security: ensure path is within project
        real_project = os.path.realpath(PROJECT_ROOT)
        # For new files, check the parent directory
        parent_real = os.path.realpath(os.path.dirname(full_path))

        # Allow creating files in new directories within project
        if not full_path.startswith(PROJECT_ROOT):
            return f"Error: Access denied. Path must be within {PROJECT_ROOT}"

        # Block writing to critical files
        blocked = ['.env.local', '.env', 'package-lock.json', 'node_modules']
        basename = os.path.basename(full_path)
        if basename in blocked or 'node_modules' in full_path:
            return f"Error: Writing to {basename} is not allowed for safety."

        try:
            # Create parent directories
            os.makedirs(os.path.dirname(full_path), exist_ok=True)

            # Backup existing file
            if create_backup and os.path.exists(full_path):
                backup_dir = os.path.join(PROJECT_ROOT, '.agent_backups')
                os.makedirs(backup_dir, exist_ok=True)
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                backup_name = f"{basename}.{timestamp}.bak"
                shutil.copy2(full_path, os.path.join(backup_dir, backup_name))

            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)

            line_count = content.count('\n') + 1
            return f"Successfully wrote {line_count} lines to {file_path}"
        except Exception as e:
            return f"Error writing file: {str(e)}"
