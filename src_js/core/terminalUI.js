import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import readline from 'readline';

export class TerminalUI {
  constructor(options = {}) {
    this.noSpinner = options.noSpinner || false;
    this.activeSpinners = new Map();

    this.agentNickname = 'paser_mini';
    this.userNickname = 'user';
  }


  writeToLog(text) {
    try {
      fs.appendFileSync('session.log', text + '\n', 'utf8');
    } catch (e) {
      console.error(`[Log Error] ${e.message}`);
    }
  }

  clearLog() {
    try {
      if (fs.existsSync('session.log')) {
        const content = fs.readFileSync('session.log', 'utf8');
        if (content) {
          fs.appendFileSync('session_history.log', content + '\n', 'utf8');
        }
      }
      fs.writeFileSync('session.log', '', 'utf8');
    } catch (e) {
      console.error(`[Log Error] ${e.message}`);
    }
  }



  /**
   * Renderiza una tabla de Markdown en formato de terminal
   */
  renderTable(tableText) {
    const lines = tableText.trim().split('\n');
    if (lines.length < 2) return tableText;

    const rows = lines
      .filter(line => line.includes('|'))
      .map(line => line.split('|').filter((cell, index, array) => {
        if (index === 0 && cell.trim() === '') return false;
        if (index === array.length - 1 && cell.trim() === '') return false;
        return true;
      }).map(cell => cell.trim()));

    const dataRows = rows.filter(row => !row.every(cell => /^[:\s\-]*$/.test(cell)));

    if (dataRows.length === 0) return tableText;

    const colWidths = [];
    dataRows.forEach(row => {
      row.forEach((cell, i) => {
        colWidths[i] = Math.max(colWidths[i] || 0, cell.length);
      });
    });

    let output = '';
    const separator = '+' + colWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';

    output += separator + '\n';
    dataRows.forEach((row, rowIndex) => {
      const line = '| ' + row.map((cell, i) => cell.padEnd(colWidths[i])).join(' | ') + ' |';
      output += chalk.white(line) + '\n';
      if (rowIndex === 0) output += separator + '\n';
    });
    output += separator;

    return '\n' + output + '\n';
  }

  /**
   * Formatea texto Markdown básico usando chalk para la terminal
   */
  formatMarkdown(text) {
    if (!text) return '';

    let formatted = text;

    const tableRegex = /((?:^\s*\|.*\n?)+)/gm;
    formatted = formatted.replace(tableRegex, (match) => this.renderTable(match));

    formatted = formatted.replace(/```([\s\S]*?)```/g, (_, code) => {
      return '\n' + chalk.gray(code.trim()) + '\n';
    });

    formatted = formatted.replace(/`([^`]+)`/g, (_, code) => {
      return chalk.cyan(` ${code} `);
    });

    formatted = formatted.replace(/\*\*(.*?)\*\*/g, (_, content) => {
      return chalk.bold(content);
    });

    formatted = formatted.replace(/\*(.*?)\*/g, (_, content) => {
      return chalk.italic(content);
    });

    return formatted;
  }

  formatChatMessage(nickname, text, time = null) {
    const t = time || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return `[${t}] <${nickname}> ${text}`;
  }

  displayChatMessage(nickname, text) {
    const trimmedText = text.trim();
    const renderedText = this.formatMarkdown(trimmedText);
    const now = new Date();
    const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    // Respect IRC aesthetics: system events do not have nicknames
    if (trimmedText.startsWith('---') || trimmedText.startsWith('***')) {
      const formatted = `[${time}] ${trimmedText}`;
      process.stdout.write(`${chalk.white(`[${time}]`)} ${renderedText}\n`);
      this.writeToLog(formatted);
      return;
    }

    const nameColor = nickname === this.agentNickname ? chalk.cyan : chalk.green;
    const formatted = `[${time}] <${nickname}> ${trimmedText}`;
    const prefix = `[${time}] <${nameColor(nickname)}>`;
    
    process.stdout.write(`${prefix} ${renderedText}\n`);
    this.writeToLog(formatted);
  }

  getLogOpenedString() {
    const now = new Date();
    const datePart = now.toDateString();
    const timePart = now.toTimeString().split(' ')[0];
    const [dayName, month, day, year] = datePart.split(' ');
    return `--- Log opened ${dayName} ${month} ${day} ${timePart} ${year}`;
  }

  displayLogOpened() {
    const logMsg = this.getLogOpenedString();
    this.displayChatMessage('user', logMsg);
  }

  displayMessage(text) {
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


  displaySystemMessage(text) {
    process.stdout.write(chalk.yellow(`*** ${text}\n`));
    this.writeToLog(`*** ${text}`);
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
    const toolIcon = '\ud83d\udee0\ufe0f'; // \ud83d\udee0\ufe0f
    const msg = `${toolIcon} ${name} (${detail})...`;

    if (this.noSpinner) {
      process.stdout.write(chalk.yellow(msg) + '\n');
      return;
    }

    const spinner = ora({
      text: chalk.yellow(msg),
      color: 'yellow'
    }).start();

    this.activeSpinners.set(name, spinner);
  }

  endToolMonitoring(name, success, detail) {
    const spinner = this.activeSpinners.get(name);
    if (spinner) {
      spinner.stop();
    }

    const now = new Date();
    const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const nameColor = chalk.cyan;
    const statusIcon = success ? '✓' : '✗';
    const statusColor = success ? chalk.green : chalk.red;
    const prefix = `[${time}] <${nameColor(this.agentNickname)}>`;
    const finalMsg = `${prefix} * ${name} (${detail}) ${statusColor(statusIcon)}`;
    
    console.log(finalMsg);
    this.writeToLog(finalMsg.replace(/\x1b\[\d+m/g, '')); // Remove ANSI colors for log file
    // Note: statusColor(statusIcon) contains ANSI, we need the plain text
    const plainStatus = success ? '✓' : '✗';
    this.writeToLog(`${prefix} * ${name} (${detail}) ${plainStatus}`);

    if (spinner) {
      this.activeSpinners.delete(name);
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
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: prompt,
        terminal: true
      });

      rl.prompt();

      rl.on('line', (line) => {
        rl.close();
        resolve(line.trim());
      });

      rl.on('close', () => {
        // No manual setRawMode needed, readline handles it
      });
    });
  }

  async getConfirmation(message) {
    const answer = await this.requestInput(message + ' [y/N] \u276f ');
    return answer.toLowerCase() === 'y';
  }
}