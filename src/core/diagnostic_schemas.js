export class DiagnosticAuditor {
  static audit(validator) {
    const audit = [];
    const keys = Array.from(validator.schemas.keys());
    for (let i = 0; i < keys.length; i += 1) {
      const toolName = keys[i];
      const schema = validator.schemas.get(toolName);
      audit.push({
        tool: toolName,
        type: typeof schema,
        hasSafeParse: typeof schema?.safeParse === "function",
        constructor: schema?.constructor?.name,
      });
    }
    console.log(JSON.stringify(audit, null, 2));
  }
}

export default DiagnosticAuditor;