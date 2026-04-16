import argparse
import asyncio
import unittest
import sys
import json
import os
from paser.infrastructure.gemini import GeminiAdapter
from paser.core.chat_manager import ChatManager
from paser.core.terminal_ui import TerminalUI
from paser.tools.registry import AVAILABLE_TOOLS, SYSTEM_INSTRUCTION

async def main():
    parser = argparse.ArgumentParser(description="Paser Mini: Minimalist Autonomous Agent")
    parser.add_argument("--version", action="version", version="paser-mini 0.1.0")
    parser.add_argument("--unit_tests", action="store_true", help="Run unit tests")
    parser.add_argument("-si", "--system_instruction", help="Custom system instructions")
    parser.add_argument("-isi", "--inject_system_instruction", help="Inject instruction at the start of system prompt")
    parser.add_argument("-m", "--message", help="Initial message to send (one-shot mode)")
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

    # Determine which system instruction to use
    base_instr = args.system_instruction if args.system_instruction else SYSTEM_INSTRUCTION
    if args.inject_system_instruction:
        sys_instr = f"{args.inject_system_instruction}\n{base_instr}"
    else:
        sys_instr = base_instr
    # Determine which input message to use
    user_input = args.message if args.message else args.input

    assistant = GeminiAdapter()
    ui = TerminalUI()
    chat_manager = ChatManager(assistant, AVAILABLE_TOOLS, sys_instr, ui)

    # Start the agent in REPL mode, processing initial input if provided
    await chat_manager.run(initial_input=user_input)

def cli():
    asyncio.run(main())

if __name__ == "__main__":
    cli()