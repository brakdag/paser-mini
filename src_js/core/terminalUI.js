import chalk from 'chalk';
import ora from 'ora';

export class TerminalUI {
  constructor(options = {}) {
    this.noSpinner = options.noSpinner || false;
    this.activeSpinners = new Map();
    this.uiMode = 'INSERT';
  }

  setUiMode(mode) {
    this.uiMode = mode;
  }

  getUiMode() {
    return this.uiMode;
  }

  /**
   * Formatea texto Markdown básico usando chalk para la terminal
   */
  formatMarkdown(text) {
    if (!text) return '';

    let formatted = text;

    // 1. Bloques de código (```code```)
    formatted = formatted.replace(/```([\s\S]*?)```/g, (_, code) => {
      return '\n' + chalk.gray(code.trim()) + '\n';
    });

    // 2. Código en línea (`code`)
    formatted = formatted.replace(/`([^`]+)`/g, (_, code) => {
      return chalk.bgGray.black(` ${code} `);
    });

    // 3. Negritas (**text**)
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, (_, content) => {
      return chalk.bold(content);
    });

    // 4. Itálicas (*text*)
    formatted = formatted.replace(/\*(.*?)\*/g, (_, content) => {
      return chalk.italic(content);
    });

    return formatted;
  }

  displayMessage(text) {
    // Usamos nuestro formateador personalizado en lugar de la librería externa
    const renderedText = this.formatMarkdown(text);
    process.stdout.write(renderedText + '\n');
  }

  displayThought(text) {
    process.stdout.write(chalk.gray.italic('\ud83d\udcad ' + text) + '\n');
  }

  displayInfo(text) {
    process.stdout.write(chalk.blue('\u2139 ') + chalk.cyan(text) + '\n');
  }

  displayError(text) {
    process.stdout.write(chalk.red('\u2716 ') + chalk.red.bold(text) + '\n');
  }

  displayPanel(title, message, style = 'none') {
    const border = '\u2500'.repeat(title.length + 4);
    const panelColor = style === 'warning' ? chalk.yellow : chalk.blue;
    
    process.stdout.write('\n' + panelColor('\u250c' + border + '\u2510') + '\n');
    process.stdout.write(panelColor('\u2502') + ' ' + chalk.bold(title) + ' ' + panelColor(' '.repeat(border.length - title.length - 2)) + ' ' + panelColor('\u2502') + '\n');
    process.stdout.write(panelColor('\u251c' + '\u2500'.repeat(border.length) + '\u2524') + '\n');
    process.stdout.write(panelColor('\u2502') + ' ' + message + ' ' + panelColor(' '.repeat(Math.max(0, border.length - message.length - 2))) + ' ' + panelColor('\u2502') + '\n');
    process.stdout.write(panelColor('\u2514' + border + '\u2518') + '\n\n');
  }

  startToolMonitoring(name, detail) {
    if (this.noSpinner) {
      process.stdout.write(chalk.yellow('\u2699 ') + chalk.gray(name + ' (' + detail + ')...') + '\n');
      return;
    }

    const spinner = ora({
      text: chalk.yellow('\u2699 ') + chalk.gray(name + ' (' + detail + ')...'),
      color: 'yellow'
    }).start();

    this.activeSpinners.set(name, spinner);
  }

  endToolMonitoring(name, success, detail) {
    const spinner = this.activeSpinners.get(name);

    if (spinner) {
      if (success) {
        spinner.succeed(chalk.green('\u2714 ') + chalk.gray(name + ' (' + detail + ') completed'));
      } else {
        spinner.fail(chalk.red('\u2716 ') + chalk.gray(name + ' (' + detail + ') failed'));
      }
      this.activeSpinners.delete(name);
    } else if (this.noSpinner) {
      const symbol = success ? chalk.green('\u2714') : chalk.red('\u2716');
      process.stdout.write(symbol + ' ' + chalk.gray(name + ' (' + detail + ') ' + (success ? 'completed' : 'failed')) + '\n');
    }
  }

  stopAllMonitoring() {
    for (const [name, spinner] of this.activeSpinners) {
      spinner.stop();
    }
    this.activeSpinners.clear();
  }

  clear() {
    process.stdout.write('\x1Bc');
  }

  async requestInput(prompt = '\u276f ') {
    return new Promise((resolve) => {
      let buffer = '';
      
      // Set raw mode to capture every keystroke
      process.stdin.setRawMode(true);
      process.stdin.resume();

      const render = () => {
        const modeLabel = this.uiMode === 'NORMAL' ? chalk.yellow('[NORMAL]') : chalk.green('[INSERT]');
        process.stdout.write('\r\x1b[K' + modeLabel + ' ' + prompt + buffer);
      };

      render();

      const onData = (data) => {
        const char = data.toString();

        if (this.uiMode === 'NORMAL') {
          if (char === 'i') {
            this.setUiMode('INSERT');
            render();
          } else if (char === '\x1b') {
            this.setUiMode('NORMAL');
            render();
          } else {
            // Other keys in NORMAL mode are ignored or could be mapped to commands
          }
        } else {
          // INSERT MODE
          if (char === '\r' || char === '\n') {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.removeListener('data', onData);
            process.stdout.write('\n');
            resolve(buffer.trim());
          } else if (char === '\x7f') {
            buffer = buffer.slice(0, -1);
            render();
          } else if (char === '\x1b') {
            this.setUiMode('NORMAL');
            render();
          } else {
            buffer += char;
            render();
          }
        }
      };

      process.stdin.on('data', onData);
    });
  }

  async getConfirmation(message) {
    const answer = await this.requestInput(message + ' [y/N] \u276f ');
    return answer.toLowerCase() === 'y';
  }
}