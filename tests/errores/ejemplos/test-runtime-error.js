function boom() {
  throw new Error('Runtime explosion test');
}

boom();
