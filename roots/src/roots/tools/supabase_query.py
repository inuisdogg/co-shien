from crewai.tools import BaseTool
from typing import Type
from pydantic import BaseModel, Field
import os
import re

PROJECT_ROOT = "/Users/inu/Desktop/kidos"


class SupabaseSchemaInput(BaseModel):
    """Input schema for SupabaseSchemaExplorerTool."""
    action: str = Field(
        ...,
        description=(
            "Action to perform: "
            "'list_migrations' - list all SQL migration files, "
            "'read_migration' - read a specific migration file, "
            "'find_table' - find table definitions across migrations, "
            "'find_rls' - find Row Level Security policies, "
            "'analyze_types' - find TypeScript type definitions matching a table"
        )
    )
    target: str = Field(
        default="",
        description="Target table name, migration filename, or search term"
    )


class SupabaseSchemaExplorerTool(BaseTool):
    name: str = "Explore Database Schema"
    description: str = (
        "Explores the Supabase database schema through migration files and TypeScript types. "
        "Can list migrations, read specific migration SQL, find table definitions, "
        "find RLS policies, and cross-reference with TypeScript type definitions."
    )
    args_schema: Type[BaseModel] = SupabaseSchemaInput

    def _run(self, action: str, target: str = "") -> str:
        if action == "list_migrations":
            return self._list_migrations()
        elif action == "read_migration":
            return self._read_migration(target)
        elif action == "find_table":
            return self._find_table(target)
        elif action == "find_rls":
            return self._find_rls(target)
        elif action == "analyze_types":
            return self._analyze_types(target)
        else:
            return (
                f"Error: Unknown action '{action}'. "
                "Use: list_migrations, read_migration, find_table, find_rls, analyze_types"
            )

    def _list_migrations(self) -> str:
        """List all SQL migration files in the project."""
        sql_files = []

        for root, dirs, files in os.walk(PROJECT_ROOT):
            # Skip non-relevant directories
            skip = {'.git', 'node_modules', '.next', '.venv', '__pycache__', 'roots'}
            dirs[:] = [d for d in dirs if d not in skip]

            for f in files:
                if f.endswith('.sql'):
                    rel_path = os.path.relpath(os.path.join(root, f), PROJECT_ROOT)
                    sql_files.append(rel_path)

        sql_files.sort()
        result = f"SQL Migration Files ({len(sql_files)} total):\n"
        result += "-" * 40 + "\n"
        for f in sql_files:
            result += f"  {f}\n"
        return result

    def _read_migration(self, filename: str) -> str:
        """Read a specific migration file."""
        # Search for the file
        for root, dirs, files in os.walk(PROJECT_ROOT):
            skip = {'.git', 'node_modules', '.next', '.venv', '__pycache__'}
            dirs[:] = [d for d in dirs if d not in skip]

            for f in files:
                if f == filename or filename in f:
                    filepath = os.path.join(root, f)
                    try:
                        with open(filepath, 'r', encoding='utf-8') as fh:
                            content = fh.read()
                        rel_path = os.path.relpath(filepath, PROJECT_ROOT)
                        return f"File: {rel_path}\n{'=' * 40}\n{content[:5000]}"
                    except Exception as e:
                        return f"Error reading {filepath}: {e}"

        return f"Migration file not found: {filename}"

    def _find_table(self, table_name: str) -> str:
        """Find CREATE TABLE statements for a given table."""
        if not table_name:
            return "Error: Please provide a table name to search for."

        results = []
        pattern = re.compile(
            rf'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?{re.escape(table_name)}',
            re.IGNORECASE
        )

        for root, dirs, files in os.walk(PROJECT_ROOT):
            skip = {'.git', 'node_modules', '.next', '.venv', '__pycache__'}
            dirs[:] = [d for d in dirs if d not in skip]

            for f in files:
                if f.endswith('.sql'):
                    filepath = os.path.join(root, f)
                    try:
                        with open(filepath, 'r', encoding='utf-8') as fh:
                            content = fh.read()
                        if pattern.search(content):
                            rel_path = os.path.relpath(filepath, PROJECT_ROOT)
                            # Extract the CREATE TABLE block
                            for match in pattern.finditer(content):
                                start = match.start()
                                # Find the end of the statement
                                end = content.find(';', start)
                                if end == -1:
                                    end = min(start + 2000, len(content))
                                block = content[start:end + 1]
                                results.append(f"In {rel_path}:\n{block}\n")
                    except Exception:
                        continue

        if results:
            return f"Table '{table_name}' definitions:\n{'=' * 40}\n" + "\n".join(results)
        return f"No CREATE TABLE found for '{table_name}'"

    def _find_rls(self, table_name: str) -> str:
        """Find RLS policies for a table."""
        if not table_name:
            return "Error: Please provide a table name."

        results = []
        pattern = re.compile(
            rf'(CREATE\s+POLICY|ALTER\s+TABLE.*ENABLE\s+ROW\s+LEVEL).*{re.escape(table_name)}',
            re.IGNORECASE
        )

        for root, dirs, files in os.walk(PROJECT_ROOT):
            skip = {'.git', 'node_modules', '.next', '.venv', '__pycache__'}
            dirs[:] = [d for d in dirs if d not in skip]

            for f in files:
                if f.endswith('.sql'):
                    filepath = os.path.join(root, f)
                    try:
                        with open(filepath, 'r', encoding='utf-8') as fh:
                            for line_num, line in enumerate(fh, 1):
                                if pattern.search(line):
                                    rel_path = os.path.relpath(filepath, PROJECT_ROOT)
                                    results.append(f"{rel_path}:{line_num}: {line.strip()}")
                    except Exception:
                        continue

        if results:
            return f"RLS policies for '{table_name}':\n" + "\n".join(results)
        return f"No RLS policies found for '{table_name}'"

    def _analyze_types(self, type_name: str) -> str:
        """Find TypeScript type/interface definitions."""
        if not type_name:
            return "Error: Please provide a type name."

        results = []
        pattern = re.compile(
            rf'(export\s+)?(type|interface)\s+{re.escape(type_name)}',
            re.IGNORECASE
        )

        types_dir = os.path.join(PROJECT_ROOT, 'src', 'types')
        search_dirs = [types_dir, os.path.join(PROJECT_ROOT, 'src')]

        for search_dir in search_dirs:
            for root, dirs, files in os.walk(search_dir):
                skip = {'node_modules', '.next', '__pycache__'}
                dirs[:] = [d for d in dirs if d not in skip]

                for f in files:
                    if f.endswith(('.ts', '.tsx')):
                        filepath = os.path.join(root, f)
                        try:
                            with open(filepath, 'r', encoding='utf-8') as fh:
                                content = fh.read()
                            for match in pattern.finditer(content):
                                start = match.start()
                                # Get surrounding context (up to 30 lines)
                                line_start = content.rfind('\n', 0, start) + 1
                                end = start
                                brace_count = 0
                                for i, ch in enumerate(content[start:start + 3000]):
                                    if ch == '{':
                                        brace_count += 1
                                    elif ch == '}':
                                        brace_count -= 1
                                        if brace_count == 0:
                                            end = start + i + 1
                                            break

                                block = content[line_start:end]
                                rel_path = os.path.relpath(filepath, PROJECT_ROOT)
                                results.append(f"In {rel_path}:\n{block[:2000]}\n")
                        except Exception:
                            continue

        if results:
            return f"TypeScript definitions for '{type_name}':\n{'=' * 40}\n" + "\n".join(results[:3])
        return f"No TypeScript type/interface found for '{type_name}'"
