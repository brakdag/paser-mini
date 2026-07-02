/**
 * Represents the result of a validation.
 */
class ValidationResult {
  /**
   * Constructs a validation result.
   * @param {boolean} isValid - Indicates if the result is valid.
   * @param {Array<string>} [errors] - List of errors.
   * @param {object|null} [correctedArgs] - Corrected arguments if any.
   */
  constructor(isValid, errors = [], correctedArgs = null) {
    this.isValid = isValid;
    this.errors = errors;
    this.correctedArgs = correctedArgs;
  }
}


export default ValidationResult;
