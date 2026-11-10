import { Command } from "commander";

/**
 * Parses CLI arguments without starting a session.
 * @param {string[]} [argv] - Arguments including the Node executable and script.
 * @returns {object} The CLI options with an explicit pure-mode flag.
 */
export default function parseCliOptions(argv = process.argv) {
  const program = new Command();

  program
    .name("paser-mini")
    .description("Minimalist Autonomous Agent (JS Port)")
    .option("--pipeline", "Read stdin as one document, write the reply and exit")
    .option("-m, --message <message>", "Initial message to send")
    .option(
      "-si, --system-instruction <instruction>",
      "Custom system instructions",
    )
    .option(
      "-isi, --inject-system-instruction <instruction>",
      "Inject instruction at the start of system prompt",
    )
    .option(
      "-fsi, --file-system-instruction <path>",
      "Path to file for system instruction injection",
    )
    .option("-nsi, --no-system-instruction", "Pure chat without system instructions, tools or MCP startup")
    .option(
      "--github-mode",
      "Run in GitHub mode: process issues with #ai-assistance",
    )
    .parse(argv);

  const options = program.opts();
  if (options.pipeline && options.githubMode) throw new Error("--pipeline cannot be combined with --github-mode");
  return {
    ...options,
    pureMode: options.systemInstruction === false,
    systemInstruction: typeof options.systemInstruction === "string" ? options.systemInstruction : undefined,
  };
}
