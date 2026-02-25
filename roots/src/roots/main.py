#!/usr/bin/env python
import sys
import warnings

from datetime import datetime

from roots.crew import Roots

warnings.filterwarnings("ignore", category=SyntaxWarning, module="pysbd")

PROJECT_ROOT = "/Users/inu/Desktop/kidos"


def run():
    """
    フル監査モード: 全エージェントが順次タスクを実行し、統合レポートを出力。
    """
    inputs = {
        'project_root': PROJECT_ROOT,
        'current_phase': '1',
        'focus_area': 'full_audit',
        'current_year': str(datetime.now().year)
    }

    try:
        result = Roots().crew().kickoff(inputs=inputs)
        print("\n" + "=" * 60)
        print("Roots 自律開発チーム - 実行完了")
        print("=" * 60)
        print(f"\n統合レポートが report.md に出力されました。")
        print(f"\n結果サマリー:\n{result}")
    except Exception as e:
        raise Exception(f"エージェントチーム実行中にエラーが発生しました: {e}")


def train():
    """
    Train the crew for a given number of iterations.
    """
    inputs = {
        'project_root': PROJECT_ROOT,
        'current_phase': '1',
        'focus_area': 'full_audit',
        'current_year': str(datetime.now().year)
    }
    try:
        Roots().crew().train(n_iterations=int(sys.argv[1]), filename=sys.argv[2], inputs=inputs)
    except Exception as e:
        raise Exception(f"An error occurred while training the crew: {e}")


def replay():
    """
    Replay the crew execution from a specific task.
    """
    try:
        Roots().crew().replay(task_id=sys.argv[1])
    except Exception as e:
        raise Exception(f"An error occurred while replaying the crew: {e}")


def test():
    """
    Test the crew execution and returns the results.
    """
    inputs = {
        'project_root': PROJECT_ROOT,
        'current_phase': '1',
        'focus_area': 'full_audit',
        'current_year': str(datetime.now().year)
    }
    try:
        Roots().crew().test(n_iterations=int(sys.argv[1]), eval_llm=sys.argv[2], inputs=inputs)
    except Exception as e:
        raise Exception(f"An error occurred while testing the crew: {e}")
