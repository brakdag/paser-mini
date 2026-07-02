import { UserInterruptException } from "./exceptions.js";

class ToolExecutor {
  static async execute(toolCalls, engine, ui, assistant, parser) {
    const toolResults = [];
    let errorCount = 0;

    for (let i = 0; i < toolCalls.length; i += 1) {
      const call = toolCalls[i];
      if (call.data) {
        if (ui.inputQueue && ui.inputQueue.length > 0) {
          throw new UserInterruptException();
        }

        const executionResult = await engine.executeToolCall(
          call.data.name,
          call.data.args,
        );
        const { response, result } = executionResult;

        if (result && result.type === "FOUNTAIN_INJECTION") {
          ui.displayChatMessage("system", result.content);
          assistant.injectMessage("user", result.content);
          assistant.injectMessage(
            "user",
            parser.formatToolResponse("OK", "OK", true),
          );
          return { results: [], errorCount: 0, terminate: true };
        }

        if (
          call.data.name === "nickname" &&
          typeof result === "string" &&
          result.startsWith("* ")
        ) {
          const [, name] = result.match(/is now known as\s+(.+)$/);
          if (name) {
            // eslint-disable-next-line no-param-reassign
            ui.agentNickname = name;
          }
        }

        toolResults.push({ response, result });
      } else if (call.error) {
        errorCount += 1;
        toolResults.push(`ERR: ${call.error}`);
      }
    }
    return { results: toolResults, errorCount, terminate: false };
  }
}

export default ToolExecutor;

