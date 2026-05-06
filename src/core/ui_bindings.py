import sys
import string
from prompt_toolkit.key_binding import KeyBindings

class UIBindings:
    @staticmethod
    def get_bindings(ui_instance):
        kb = KeyBindings()

        # Esc: No longer changes mode, simply passed through or used for interruption
        @kb.add('escape')
        def _(event):
            pass

        # Todas las teclas ahora insertan texto directamente sin comprobar modos
        special_vim_keys = set()
        chars_to_block = (string.ascii_letters + string.digits + " " + "\u201e\u00a5\u221a")
        for char in chars_to_block:
            @kb.add(char)
            def _(event, c=char):
                event.current_buffer.insert_text(c)
        
        return kb
