import asyncio
import logging
import time
from typing import List, Dict, Any, Optional

from src.tools import github_tools
from src.core.github_ui import GitHubUI
from src.core.chat_manager import ChatManager
from src.infrastructure.gemini.adapter import GeminiAdapter
from src.infrastructure.nvidia.adapter import NvidiaAdapter
from src.core.config_manager import ConfigManager
from src.tools.registry import AVAILABLE_TOOLS

logger = logging.getLogger("src")

class GitHubModeOrchestrator:
    """
    Orchestrates the execution of paser-mini in GitHub mode.
    Handles issue detection, communication, and the feedback loop.
    """

    def __init__(self, system_instruction: str):
        self.system_instruction = system_instruction
        self.config_manager = ConfigManager()
        self.processing_label = "paser-processing"
        self.trigger_hashtag = "#ai-assistance"

    async def run(self):
        """Main entry point for GitHub mode."""
        logger.info("Starting GitHub Mode Orchestrator...")
        try:
            issues = github_tools.list_issues()
            eligible_issues = self._filter_issues(issues)
            
            if not eligible_issues:
                logger.info("No eligible issues found.")
                return

            for issue in eligible_issues:
                await self.process_issue(issue)

        except Exception as e:
            logger.exception(f"Critical error in GitHub mode: {e}")

    def _filter_issues(self, issues: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        eligible = []
        for issue in issues:
            body = issue.get("body") or ""
            labels = [l["name"] for l in issue.get("labels", [])]
            
            if self.trigger_hashtag in body and self.processing_label not in labels:
                eligible.append(issue)
        return eligible

    async def process_issue(self, issue: Dict[str, Any]):
        issue_number = issue["number"]
        issue_body = issue.get("body", "")
        
        logger.info(f"Processing issue #{issue_number}...")
        
        try:
            # 1. Mark as processing
            github_tools.add_label(issue_number, self.processing_label)
            
            # 2. Initial Acknowledgment
            ack_message = (f"🤖 **Hola! He detectado tu solicitud de ayuda.**\n\n"
                           f"Me pongo a trabajar en ello ahora mismo. Analizaré el problema, "
                           f"diseñaré un plan y te informaré de los avances aquí mismo.")
            github_tools.post_comment(issue_number, ack_message)

            # 3. Setup Agent
            ui = GitHubUI()
            provider = self.config_manager.get("provider", "Gemini")
            assistant = NvidiaAdapter() if provider == "NVIDIA" else GeminiAdapter()
            
            chat_manager = ChatManager(
                assistant, AVAILABLE_TOOLS, self.system_instruction, ui, instance_mode=True
            )

            # 4. Execution Loop with Feedback
            # We run the agent and monitor for comments simultaneously
            current_input = issue_body
            last_comment_id = self._get_last_comment_id(issue_number)
            
            # We use a loop to handle the initial request and any subsequent feedback
            while True:
                # Start the execution as a task so we can cancel it if a new comment arrives
                exec_task = asyncio.create_task(chat_manager.execute(current_input))
                
                # Monitor for new comments while the task is running
                comment_data = await self._wait_for_comment_or_completion(exec_task, issue_number, last_comment_id)
                
                if comment_data:
                    new_comment, new_id = comment_data
                    # User interrupted! Cancel current work and pivot
                    exec_task.cancel()
                    try:
                        await exec_task
                    except asyncio.CancelledError:
                        pass
                    
                    logger.info(f"User feedback received on issue #{issue_number}. Pivoting...")
                    github_tools.post_comment(issue_number, "📝 **He leído tu comentario. Ajustando el plan de trabajo...**")
                    current_input = new_comment
                    last_comment_id = new_id
                    # Continue loop to restart execution with new input
                    continue
                else:
                    # Task completed normally
                    final_result = await exec_task
                    break

            # 5. Final Reporting
            final_output = ui.get_buffered_output() or final_result
            report = (f"✅ **He terminado la tarea.**\n\n"
                     f"{final_output}\n\n"
                     f"**Por favor, revisa los cambios. Si estás satisfecho, puedes cerrar este issue.**")
            github_tools.post_comment(issue_number, report)

        except Exception as e:
            logger.exception(f"Error processing issue #{issue_number}: {e}")
            github_tools.post_comment(issue_number, f"❌ **Hubo un error durante la ejecución:**\n`{str(e)}`")
        finally:
            # Always remove the processing label
            try:
                github_tools.remove_label(issue_number, self.processing_label)
            except Exception as e:
                logger.error(f"Failed to remove label from issue #{issue_number}: {e}")

    def _get_last_comment_id(self, issue_number: int) -> int:
        comments = github_tools.get_issue_comments(issue_number)
        if not comments:
            return 0
        return comments[-1]["id"]

    async def _wait_for_comment_or_completion(self, task: asyncio.Task, issue_number: int, last_id: int):
        """
        Polls GitHub for new comments while waiting for the execution task to complete.
        Returns (body, id) of the new comment if found, otherwise None.
        """
        while not task.done():
            try:
                comments = github_tools.get_issue_comments(issue_number)
                if comments and comments[-1]["id"] > last_id:
                    return comments[-1]["body"], comments[-1]["id"]
            except Exception as e:
                logger.error(f"Error polling comments: {e}")
            
            await asyncio.sleep(30) # Poll every 30 seconds
        
        return None
