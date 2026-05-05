import chalk from 'chalk';
import ora from 'ora';

export class TerminalUI {
  constructor(options = {}) {
    this.noSpinner = options.noSpinner || false;
    this.activeSpinners = new Map();
  }

  displayMessage(text) {
    process.stdout.write(chalk.white(text) + '\n');
  }

  displayInfo(text) {
    process.stdout.write(chalk.blue('\u2139 ') + chalk.cyan(text) + '\n');
  }

  displayError(text) {
    process.stdout.write(chalk.red('\u2716 ') + chalk.red.bold(text) + '\n');
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

  clear() {
    process.stdout.write('\x1Bc');
  }

  async requestInput(rl, prompt) {
    return new Promise((resolve) => {
      // Forzamos la limpieza de la línea antes de preguntar
      process.stdout.write('\r'); 
      rl.question(chalk.yellow('\u276f ') + prompt, (answer) => {
        resolve(answer ? answer.toString() : '');
      });
    });
  }
}