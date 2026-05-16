class ValidationResult {
  constructor(isValid, errors = [], correctedArgs = null) {
    this.isValid = isValid;
    this.errors = errors;
    this.correctedArgs = correctedArgs;
  }
}


export default ValidationResult;
