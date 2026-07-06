// ejemplo.js
// Simple demo for debugging math operations and variable assignments

// Variable assignments
const a = 5;
let b = 3;

console.log("Initial values:", { a, b });

// Basic arithmetic operations
const sum = a + b;           // Addition
const diff = a - b;          // Subtraction
const prod = a * b;          // Multiplication
const quotient = a / b;      // Division

// Log each operation
console.log("Addition:", sum);
console.log("Subtraction:", diff);
console.log("Multiplication:", prod);
console.log("Division:", quotient);

// Demonstrating variable reassignment
b = 10;
console.log("After reassigning b to 10:", { b, sum });

// Function to compute factorial
function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

console.log("Factorial of 4:", factorial(4));

// Simple conditional
if (sum > 10) {
  console.log("The sum is greater than 10.");
} else {
  console.log("The sum is 10 or less.");
}
