import chalk from 'chalk';
import ora from 'ora';

export class TerminalUI {
  constructor(options = {}) {
    this.noSpinner = options.noSpinner || false;
    this.activeSpinners = new Map();
  }

  displayMessage(text) {
    console.log(chalk.white(text));
  }

  displayInfo(text) {
    console.log(chalk.blue('ℹ ') + chalk.cyan(text));
  }

  displayError(text) {
    console.log(chalk.red('✖ ') + chalk.red.bold(text));
  }

  startToolMonitoring(name, detail) {
    if (this.noSpinner) {
      console.log(chalk.yellow('⚙ ') + chalk.gray(name + ' (' + detail + ')...'));
      return;
    }

    const spinner = ora({
      text: chalk.yellow('⚙ ') + chalk.gray(name + ' (' + detail + ')...'),
      color: 'yellow'
    }).start();

    this.activeSpinners.set(name, spinner);
  }

  endToolMonitoring(name, success, detail) {
    const spinner = this.activeSpinners.get(name);

    if (spinner) {
      if (success) {
        spinner.succeed(chalk.green('✔ ') + chalk.gray(name + ' (' + detail + ') completed'));
      } else {
        spinner.fail(chalk.red('✖ ') + chalk.gray(name + ' (' + detail + ') failed'));
      }
      this.activeSpinners.delete(name);
    } else if (this.noSpinner) {
      const symbol = success ? chalk.green('✔') : chalk.red('✖');
      console.log(symbol + ' ' + chalk.gray(name + ' (' + detail + ') ' + (success ? 'completed' : 'failed')));
    }
  }

  clear() {
    process.stdout.write('\x1Bc');
  }
}