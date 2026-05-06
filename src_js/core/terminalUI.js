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

  displayMessage(text) {
    process.stdout.write(chalk.white(text) + '\n');
  }

  displayThought(text) {
    process.stdout.write(chalk.gray.italic('💭 ' + text) + '\n');
  }

  displayInfo(text) {
    process.stdout.write(chalk.blue('\u2139 ') + chalk.cyan(text) + '\n');
  }

  displayError(text) {
    process.stdout.write(chalk.red('\u2716 ') + chalk.red.bold(text) + '\n');
  }

  displayPanel(title, message, style = 'none') {
    const border = '─'.repeat(title.length + 4);
    const panelColor = style === 'warning' ? chalk.yellow : chalk.blue;
    
    process.stdout.write('\n' + panelColor('┌' + border + '┐') + '\n');
    process.stdout.write(panelColor('│') + ' ' + chalk.bold(title) + ' ' + panelColor(' '.repeat(border.length - title.length - 2)) + ' ' + panelColor('│') + '\n');
    process.stdout.write(panelColor('├' + '─'.repeat(border.length) + '┤') + '\n');
    process.stdout.write(panelColor('│') + ' ' + message + ' ' + panelColor(' '.repeat(Math.max(0, border.length - message.length - 2))) + ' ' + panelColor('│') + '\n');
    process.stdout.write(panelColor('└' + border + '┘') + '\n\n');
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

  async requestInput(prompt = '❯ ') {
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
          } else if (char === '\x1b') { // Esc
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
          } else if (char === '\x7f') { // Backspace
            buffer = buffer.slice(0, -1);
            render();
          } else if (char === '\x1b') { // Esc
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
    const answer = await this.requestInput(message + ' [y/N] ❯ ');
    return answer.toLowerCase() === 'y';
  }
}