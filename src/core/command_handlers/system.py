import os

class SystemCommands:
    @staticmethod
    def handle_clear(ui):
        os.system("cls" if os.name == "nt" else "clear")
        return True

    @staticmethod
    def handle_exit(chat_manager):
        chat_manager.should_exit = True
        import sys
        sys.exit(0)
