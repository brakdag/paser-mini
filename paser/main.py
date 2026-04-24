import argparse
import asyncio
import unittest
import sys
import json
import os
from paser.infrastructure.gemini import GeminiAdapter
from paser.core.chat_manager import ChatManager
from paser.core.terminal_ui import TerminalUI
from paser.core.logging import setup_logger
from paser.tools.registry import AVAILABLE_TOOLS, SYSTEM_INSTRUCTION

async def main():
    parser = argparse.ArgumentParser(
        description="Paser Mini: Minimalist Autonomous Agent",
        epilog="\nInternal Agent Commands:\n  /help     - Show the available commands menu\n  /models   - Change AI model and adjust temperature\n  /s        - Save a snapshot of the last interaction\n  /t        - Display the current context window token count\n  /timeout  - Set the timeout for run_instance\n  /sandbox  - Toggle WebAssembly sandbox mode\n  /tpm      - Set Auto RPM based on TPM\n  /reset    - Hard Reset: Clear history and Leap via Bridge Block\n  /q, /quit, /exit - Exit the application"
    )
    parser.add_argument("-v", "--version", action="version", version="paser-mini 0.1.0")
    parser.add_argument("-ut", "--unit_tests", action="store_true", help="Run unit tests")
    parser.add_argument("-si", "--system_instruction", help="Custom system instructions")
    parser.add_argument("-isi", "--inject_system_instruction", help="Inject instruction at the start of system prompt")
    parser.add_argument("-fsi", "--file_system_instruction", help="Path to file for system instruction injection")
    parser.add_argument("-m", "--message", help="Initial message to send (one-shot mode)")
    parser.add_argument("-i", "--input", help="Input text to process (one-shot mode)")
    parser.add_argument("-im", "--instance-mode", action="store_true", help="Run in instance mode (read-only config and no recursion)")
    parser.add_argument("--run-instance-timeout", "-rito", type=int, help="Timeout for run_instance tool in seconds")
    parser.add_argument("-d", "--debug", action="store_true", help="Enable debug logging")
    
    args = parser.parse_args()
    
    # Save instance timeout to config if provided
    from paser.core.config_manager import ConfigManager
    if args.run_instance_timeout:
        ConfigManager().save("instance_timeout", args.run_instance_timeout)

    setup_logger(debug=args.debug)
    
    try:
        ui = TerminalUI(no_spinner=args.instance_mode, force_terminal=not args.instance_mode)
        
    except Exception as e:
        print(f"ERROR EN UI: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    if args.unit_tests:
        ui.display_info("Running unit tests")
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
    
    # Handle injection from string or file
    injection = ""
    if args.inject_system_instruction:
        injection = args.inject_system_instruction
    elif args.file_system_instruction:
        try:
            with open(args.file_system_instruction, "r") as f:
                injection = f.read()
        except Exception as e:
            ui.display_info(f"Error reading instruction file: {e}")
            sys.exit(1)

    sys_instr = f"{injection}\n{base_instr}" if injection else base_instr

    # Determine which input message to use
    user_input = args.message if args.message else args.input

    # Lazy initialization of ChatManager inside run loop would be ideal,
    # but for now we ensure UI is ready before heavy lifting.
    ui.display_info("Inicializando motor de IA...")
    from paser.infrastructure.gemini.adapter import GeminiAdapter
    from paser.infrastructure.nvidia.adapter import NvidiaAdapter
    from paser.core.config_manager import ConfigManager

    provider = ConfigManager().get("provider", "Gemini")
    assistant = NvidiaAdapter() if provider == "NVIDIA" else GeminiAdapter()
    chat_manager = ChatManager(assistant, AVAILABLE_TOOLS, sys_instr, ui, instance_mode=args.instance_mode)

    # Setup Emergency Stop Listener
    if not args.instance_mode:
        try:
            from pynput import keyboard
            def on_press(key):
                if key == keyboard.Key.esc:
                    chat_manager.stop_requested = True
            
            listener = keyboard.Listener(on_press=on_press)
            listener.start()
        except ImportError:
            ui.display_info("pynput not installed. Emergency Stop (Esc) disabled.")

    # Start the agent in REPL mode, processing initial input if provided
    await chat_manager.run(initial_input=user_input)

def cli():
    asyncio.run(main())

if __name__ == "__main__":
    cli()