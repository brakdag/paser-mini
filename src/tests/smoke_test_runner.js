import { runSmokeTest } from './smoke_test.js';

async function main() {
  try {
    await runSmokeTest();
    process.exit(0);
  } catch (e) {
    process.exit(1);
  }
}

main();