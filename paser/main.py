import argparse
import asyncio
import unittest
import sys
import json
import os
from paser.infrastructure.gemini_adapter import GeminiAdapter
from paser.core.chat_manager import ChatManager
from paser.core.terminal_ui import TerminalUI
from paser.tools.registry import AVAILABLE_TOOLS, SYSTEM_INSTRUCTION

async def main():
    parser = argparse.ArgumentParser(description="Paser Mini: Minimalist Autonomous Agent")
    parser.add_argument("--version", action="version", version="paser-mini 0.1.0")
    parser.add_argument("--unit_tests", action="store_true", help="Run unit tests")
    parser.add_argument("input", nargs="?", help="Input text to process (one-shot mode)")
    
    args = parser.parse_args()

    if args.unit_tests:
        print("--- Running unit tests ---")
        suite = unittest.TestLoader().discover('tests', pattern='test_*.py')
        runner = unittest.TextTestRunner(stream=sys.stdout, verbosity=2)
        result = runner.run(suite)
        
        report = {
            "success": result.wasSuccessful(),
            "total": result.testsRun,
            "errors": len(result.errors),
            "failures": len(result.failures),
            "skipped": len(result.skipped)
        }
        
        with open("tests/test_results.json", "w") as f:
            json.dump(report, f, indent=4)
        
        sys.exit(0 if result.wasSuccessful() else 1)

    assistant = GeminiAdapter()
    ui = TerminalUI()
    chat_manager = ChatManager(assistant, AVAILABLE_TOOLS, SYSTEM_INSTRUCTION, ui)

    if args.input:
        # One-shot mode: process input and exit
        await chat_manager._initialize_chat()
        result = await chat_manager.execute_single(args.input)
        print(result)
    else:
        # REPL mode
        await chat_manager.run()

def cli():
    asyncio.run(main())

if __name__ == "__main__":
    cli()