import sys
import string
from prompt_toolkit.key_binding import KeyBindings

class UIBindings:
    @staticmethod
    def get_bindings(ui_instance):
        kb = KeyBindings()

        @kb.add('escape')
        def _(event):
            ui_instance.last_cursor_pos = event.current_buffer.cursor_position
            ui_instance.set_ui_mode('NORMAL')

        @kb.add('i')
        def _(event):
            if ui_instance.get_ui_mode() == 'NORMAL':
                ui_instance.set_ui_mode('INSERT')
                event.current_buffer.cursor_position = ui_instance.last_cursor_pos
            else:
                event.current_buffer.insert_text('i')

        @kb.add('j')
        def _(event):
            if ui_instance.get_ui_mode() == 'NORMAL':
                sys.stdout.write('\x1b[6~')
                sys.stdout.flush()
            else:
                event.current_buffer.insert_text('j')

        @kb.add('k')
        def _(event):
            if ui_instance.get_ui_mode() == 'NORMAL':
                sys.stdout.write('\x1b[5~')
                sys.stdout.flush()
            else:
                event.current_buffer.insert_text('k')

        @kb.add('h')
        def _(event):
            if ui_instance.get_ui_mode() == 'NORMAL':
                event.current_buffer.cursor_left()
            else:
                event.current_buffer.insert_text('h')

        @kb.add('l')
        def _(event):
            if ui_instance.get_ui_mode() == 'NORMAL':
                event.current_buffer.cursor_right()
            else:
                event.current_buffer.insert_text('l')

        special_vim_keys = {'h', 'j', 'k', 'l', 'i'}
        chars_to_block = (string.ascii_letters + string.digits + " " + "\u201e\u00a5\u221a")
        for char in chars_to_block:
            if char.lower() in special_vim_keys: continue
            @kb.add(char)
            def _(event, c=char):
                if ui_instance.get_ui_mode() == 'NORMAL': return
                event.current_buffer.insert_text(c)
        
        return kb
