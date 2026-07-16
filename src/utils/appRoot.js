import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * The absolute root directory of the application.
 * Resolves to the folder containing package.json.
 */
export default resolve(__dirname, "../../");
