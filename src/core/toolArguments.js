/**
 * Converts documented legacy argument names to the public canonical names.
 * Conflicting values are rejected instead of silently choosing a destination.
 * @param {object} args - Named arguments from a caller.
 * @param {Record<string, string>} aliases - Legacy name to canonical name mapping.
 * @returns {object} A copy containing canonical keys only.
 */
export default function normalizeArgumentNames(args, aliases = {}) {
  const normalized = { ...args };
  Object.entries(aliases).forEach(([legacy, canonical]) => {
    if (Object.hasOwn(normalized, legacy)) {
      const value = normalized[legacy];
      if (value !== undefined) {
        if (normalized[canonical] !== undefined && normalized[canonical] !== value) {
          throw new Error(`Conflicting arguments: ${canonical} and ${legacy}`);
        }
        normalized[canonical] = value;
      }
      delete normalized[legacy];
    }
  });
  return normalized;
}
