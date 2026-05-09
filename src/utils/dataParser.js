export class ParserError extends Error {
  constructor(message) {
    super(message);
    this.name = "ParserError";
  }
}

export function parseData(data) {
  if (!data || data.trim() === "") {
    throw new ParserError("The provided data is empty. Please ensure the file or response contains content.");
  }

  try {
    return JSON.parse(data);
  } catch (e) {
    throw new ParserError("The data format is invalid. Please check that it is a valid JSON structure.");
  }
}