export class ValidationResult {
  constructor(isValid, errors = [], correctedArgs = null) {
    this.isValid = isValid;
    this.errors = errors;
    this.correctedArgs = correctedArgs;
  }
}
