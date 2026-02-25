from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai.agents.agent_builder.base_agent import BaseAgent
from typing import List

from roots.tools.file_reader import FileReaderTool
from roots.tools.file_writer import FileWriterTool
from roots.tools.directory_explorer import DirectoryExplorerTool
from roots.tools.shell_runner import ShellRunnerTool
from roots.tools.grep_search import GrepSearchTool
from roots.tools.supabase_query import SupabaseSchemaExplorerTool


@CrewBase
class Roots():
    """Roots - 障害児通所支援SaaS自律開発チーム"""

    agents: List[BaseAgent]
    tasks: List[Task]

    # === Agents ===

    @agent
    def project_manager(self) -> Agent:
        return Agent(
            config=self.agents_config['project_manager'],
            tools=[FileReaderTool(), DirectoryExplorerTool(), GrepSearchTool()],
            verbose=True,
            allow_delegation=True
        )

    @agent
    def frontend_developer(self) -> Agent:
        return Agent(
            config=self.agents_config['frontend_developer'],
            tools=[
                FileReaderTool(),
                FileWriterTool(),
                DirectoryExplorerTool(),
                GrepSearchTool()
            ],
            verbose=True
        )

    @agent
    def backend_developer(self) -> Agent:
        return Agent(
            config=self.agents_config['backend_developer'],
            tools=[
                FileReaderTool(),
                FileWriterTool(),
                ShellRunnerTool(),
                SupabaseSchemaExplorerTool()
            ],
            verbose=True
        )

    @agent
    def design_reviewer(self) -> Agent:
        return Agent(
            config=self.agents_config['design_reviewer'],
            tools=[FileReaderTool(), GrepSearchTool(), DirectoryExplorerTool()],
            verbose=True
        )

    @agent
    def manual_checker(self) -> Agent:
        return Agent(
            config=self.agents_config['manual_checker'],
            tools=[FileReaderTool(), GrepSearchTool(), DirectoryExplorerTool()],
            verbose=True
        )

    @agent
    def compliance_officer(self) -> Agent:
        return Agent(
            config=self.agents_config['compliance_officer'],
            tools=[FileReaderTool(), GrepSearchTool()],
            verbose=True
        )

    @agent
    def qa_engineer(self) -> Agent:
        return Agent(
            config=self.agents_config['qa_engineer'],
            tools=[ShellRunnerTool(), FileReaderTool(), GrepSearchTool()],
            verbose=True
        )

    # === Tasks ===

    @task
    def project_analysis(self) -> Task:
        return Task(
            config=self.tasks_config['project_analysis'],
        )

    @task
    def code_audit(self) -> Task:
        return Task(
            config=self.tasks_config['code_audit'],
        )

    @task
    def spec_verification(self) -> Task:
        return Task(
            config=self.tasks_config['spec_verification'],
        )

    @task
    def compliance_review(self) -> Task:
        return Task(
            config=self.tasks_config['compliance_review'],
        )

    @task
    def design_consistency_check(self) -> Task:
        return Task(
            config=self.tasks_config['design_consistency_check'],
        )

    @task
    def build_verification(self) -> Task:
        return Task(
            config=self.tasks_config['build_verification'],
        )

    @task
    def synthesis_report(self) -> Task:
        return Task(
            config=self.tasks_config['synthesis_report'],
            output_file='report.md'
        )

    # === Crew ===

    @crew
    def crew(self) -> Crew:
        """Creates the Roots autonomous development team"""
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True,
            memory=False,
        )
