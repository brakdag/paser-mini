import fs from "fs";
import { generateSystemInstruction, AVAILABLE_TOOLS } from "../infrastructure/registry.js";

/**
 *
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
    } else if (options.fileSystemInstruction) {
      try {
        injection = fs.readFileSync(options.fileSystemInstruction, "utf8");

        // Parse TOOLS_AVAILABLE from the persona log to filter available tools
        const toolsMatch = injection.match(/TOOLS_AVAILABLE\s*=\s*(\[.*?\])/s);
        if (toolsMatch) {
          try {
            const availableList = JSON.parse(toolsMatch[1]);
            filteredTools = Object.fromEntries(
              Object.entries(AVAILABLE_TOOLS).filter(([name]) => availableList.includes(name))
            );
          } catch (e) {
            console.warn(`Warning: Could not parse TOOLS_AVAILABLE array in ${options.fileSystemInstruction}: ${e.message}`);
          }
        }
      } catch (e) {
        throw new Error(`Error reading instruction file: ${e.message}`);
      }
    }

    // 2. Determine Base Instruction
    const baseInstr = options.systemInstruction 
      || generateSystemInstruction(Object.keys(filteredTools));

    // 3. Aggregate Final Prompt
    const finalInstruction = injection
      ? `IDENTITY AND PERSONA:\n${injection}\n\nCORE OPERATIONAL PROTOCOLS:\n${baseInstr}`
      : baseInstr;

    return {
      systemInstruction: finalInstruction,
      filteredTools,
    };
  }
}

export default SystemPromptManager;