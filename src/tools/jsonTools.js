import fs from "fs/promises";
import path from "path";

// Helper para validar rutas y evitar Path Traversal
const getSafePath = (inputPath) => {
  const resolved = path.resolve(process.cwd(), inputPath);
  if (!resolved.startsWith(process.cwd())) {
    throw new Error("Security Error: Path is outside of project root");
  }
  return resolved;
};

function parsePath(pathStr) {
  const normalized = pathStr.replace(/\[(\d+)\]/g, ".$1");
  return normalized
    .split(".")
    .filter((p) => p)
    .map((p) => (typeof p === "string" && /\d+/.test(p) ? parseInt(p, 10) : p));
}

function getByPath(data, pathParts) {
  let current = data;
  for (let i = 0; i < pathParts.length; i += 1) {
    const part = pathParts[i];
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      throw new Error(`Path segment '${part}' not found.`);
    }
  }
  return current;
}

function setByPath(data, pathParts, value) {
  let current = data;
  for (let i = 0; i < pathParts.length - 1; i += 1) {
    const part = pathParts[i];
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      throw new Error(`Path segment '${part}' not found.`);
    }
  }

  const lastPart = pathParts[pathParts.length - 1];
  if (current && typeof current === "object") {
    current[lastPart] = value;
  } else {
    throw new TypeError("Cannot set value at specified path.");
  }
}

export const getJsonStructure = async ({ filePath, path: pathStr }) => {
  try {
    const safePath = getSafePath(filePath);
    const content = await fs.readFile(safePath, "utf8");
    const data = JSON.parse(content);
    const parts = parsePath(pathStr);
    const target = getByPath(data, parts);

    if (Array.isArray(target)) {
      return JSON.stringify({
        type: "array",
        length: target.length,
        itemType: target.length > 0 ? typeof target[0] : "unknown",
      });
    }
    if (target !== null && typeof target === "object") {
      return JSON.stringify({
        type: "object",
        keys: Object.keys(target),
      });
    }
    return JSON.stringify({
      type: typeof target,
      value: target,
    });
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const getJsonNode = async ({ filePath, path: pathStr }) => {
  try {
    const safePath = getSafePath(filePath);
    const content = await fs.readFile(safePath, "utf8");
    const data = JSON.parse(content);
    const parts = parsePath(pathStr);
    const target = getByPath(data, parts);
    return JSON.stringify(target, null, 2);
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const getJsonArrayInfo = async ({ filePath, path: pathStr }) => {
  try {
    const safePath = getSafePath(filePath);
    const content = await fs.readFile(safePath, "utf8");
    const data = JSON.parse(content);
    const parts = parsePath(pathStr);
    const target = getByPath(data, parts);

    if (!Array.isArray(target)) {
      return `ERR: Path '${pathStr}' does not point to an array.`;
    }

    return JSON.stringify({
      length: target.length,
      itemType: target.length > 0 ? typeof target[0] : "unknown",
    });
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};

export const updateJsonNode = async ({ filePath, path: pathStr, value }) => {
  try {
    const safePath = getSafePath(filePath);
    const content = await fs.readFile(safePath, "utf8");
    const data = JSON.parse(content);
    const parts = parsePath(pathStr);
    setByPath(data, parts, value);
    await fs.writeFile(safePath, JSON.stringify(data, null, 2), "utf8");
    return "OK";
  } catch (e) {
    return `ERR: ${e.message}`;
  }
};
