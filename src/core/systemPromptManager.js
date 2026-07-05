import fs from "fs";
import {
  generateSystemInstruction,
  AVAILABLE_TOOLS,
} from "../infrastructure/registry.js";

/**
 * SystemPromptManager handles the construction of the system prompt,
 * incorporating CLI injections and filtering tools based on persona requirements.
 */
class SystemPromptManager {
  /**
   * Constructs the final system prompt and filters tools based on CLI options.
   * @param {object} options - The parsed CLI options from commander.
   * @returns {{systemInstruction: string, filteredTools: object}} An object containing the final system instruction and the filtered tools.
   */
  buildPrompt(options) {
    if (options.noSystemInstruction) {
      return {
        systemInstruction: "",
        filteredTools: {},
      };
    }

    let injection = "";
    let filteredTools = { ...AVAILABLE_TOOLS };

    // 1. Handle Injections
    if (options.injectSystemInstruction) {
      injection = options.injectSystemInstruction;
    } else {
      const defaultPath = ".staff/default.log";
      const filePath = options.fileSystemInstruction || (fs.existsSync(defaultPath) ? defaultPath : null);

      if (filePath) {
        try {
          injection = fs.readFileSync(filePath, "utf8");

          // Parse TOOLS_AVAILABLE from the persona log to filter available tools
          const toolsMatch = injection.match(/TOOLS_AVAILABLE\s*=\s*(\[.*?\])/s);
          if (toolsMatch) {
            try {
              const availableList = JSON.parse(toolsMatch[1]);
              filteredTools = Object.fromEntries(
                Object.entries(AVAILABLE_TOOLS).filter(([name]) =>
                  availableList.includes(name),
                ),
              );
            } catch (e) {
              console.warn(
                `Warning: Could not parse TOOLS_AVAILABLE array in ${filePath}: ${e.message}`,
              );
            }
          }
        } catch (e) {
          throw new Error(`Error reading instruction file ${filePath}: ${e.message}`);
        }
      }
    }

    // 2. Determine Base Instruction
    const baseInstr =
      options.systemInstruction ||
      generateSystemInstruction(Object.keys(filteredTools));

    // 3. Aggregate Final Prompt
    const finalInstruction = injection
      ? `PERSON AND ROLE:
${injection}

CORE OPERATIONAL PROTOCOLS:
${baseInstr}`
      : baseInstr;

    return {
      systemInstruction: finalInstruction,
      filteredTools,
    };
  }
}

export default SystemPromptManager;
