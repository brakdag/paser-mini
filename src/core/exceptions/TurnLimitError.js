/** A predictable stop at a turn boundary, without another model request. */
export default class TurnLimitError extends Error {
  name = "TurnLimitError";
}
