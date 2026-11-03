import fs from "fs";
import path from "path";

/**
 * Root directory that bounds every filesystem operation.
 * Resolved once so that later changes to the process working directory
 * cannot silently widen or shift the accessible tree.
 * @type {string}
 */
const ROOT = path.resolve(process.cwd());

/**
 * Maximum number of symlink hops followed while canonicalizing a path.
 * @type {number}
 */
const MAX_SYMLINK_DEPTH = 40;

/**
 * Cached real path of the root, resolving any symlinks in the root itself
 * (for example /tmp on platforms where it links to /private/tmp).
 * @type {string|null}
 */
let cachedRealRoot = null;

/**
 * Returns the real (symlink-resolved) path of the project root.
 * @returns {string} The canonical root path.
 */
function getRealRoot() {
  if (cachedRealRoot === null) {
    try {
      cachedRealRoot = fs.realpathSync(ROOT);
    } catch {
      cachedRealRoot = ROOT;
    }
  }
  return cachedRealRoot;
}

/**
 * Reports whether a resolved path is inside a base directory.
 * Uses path.relative so that names such as "..cache" are not mistaken
 * for traversal attempts.
 * @param {string} base - Absolute base directory.
 * @param {string} target - Absolute path to test.
 * @returns {boolean} True when target is base or inside it.
 */
function isInside(base, target) {
  const relative = path.relative(base, target);
  if (relative === "") return true;
  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

/**
 * Splits an absolute path into its root and remaining segments.
 * @param {string} absolute - Absolute path to split.
 * @returns {{root: string, segments: string[]}} Root and segments.
 */
function splitAbsolute(absolute) {
  const parsed = path.parse(absolute);
  return {
    root: parsed.root,
    segments: absolute.slice(parsed.root.length).split(path.sep).filter(Boolean),
  };
}

/**
 * Canonicalizes a path the way the operating system traverses it, following
 * symlinks even when their targets do not exist.
 *
 * How this differs from fs.realpathSync and from lexical resolution:
 *
 * 1. fs.realpathSync reports ENOENT both for a genuinely missing component and
 *    for a symlink whose target is missing. Treating the latter as an ordinary
 *    missing component lets a link to a nonexistent external file pass
 *    validation, and a later write creates that file outside the root. This
 *    walker inspects every component with lstat, so a dangling link is
 *    followed to its target.
 *
 * 2. path.resolve collapses ".." lexically. That is wrong once an intermediate
 *    component is a symlink: for "bridge/../outside.txt" where "bridge" points
 *    to an external directory, the OS resolves "bridge" first, so ".." means
 *    the external directory's parent, not the lexical parent. Collapsing ".."
 *    textually therefore accepts paths the kernel would send outside the root.
 *    To match the kernel, segments are processed one at a time against the
 *    already-resolved prefix: ".." is applied to that resolved prefix, never to
 *    a string that still contains unresolved links.
 *
 * Segments are consumed from a work queue. Following a link pushes the link's
 * target segments onto the front of that queue rather than resolving them
 * textually, so both of the above hold transitively. Once a component is known
 * not to exist, no deeper component can exist and therefore none can be a
 * link, until ".." returns to an existing ancestor and inspection resumes.
 *
 * Known limitation: this is a check-then-use design. A concurrent filesystem
 * change between validation and the subsequent open/write can still redirect
 * the operation. Closing that window requires opening with O_NOFOLLOW-style
 * primitives per component or an OS sandbox; it is documented here rather than
 * silently implied.
 * @param {string} inputPath - Path to canonicalize.
 * @returns {string} Canonical path.
 */
function canonicalize(inputPath) {
  // The caller supplies an absolute path with its original segments intact.
  const initial = splitAbsolute(inputPath);

  let current = initial.root;
  /** @type {string[]} */
  const queue = initial.segments.slice();
  let hops = 0;
  // Track depth so inspection resumes if ".." returns to an existing parent.
  let missingDepth = 0;

  while (queue.length > 0) {
    const segment = queue.shift();

    if (segment === "..") {
      // Applied to the resolved prefix, never to an unresolved string.
      const parent = path.dirname(current);
      current = parent === current ? current : parent;
      if (missingDepth > 0) missingDepth -= 1;
    } else if (segment !== "" && segment !== ".") {
      const next = path.join(current, segment);

      if (missingDepth > 0) {
        missingDepth += 1;
        current = next;
      } else {
        let stats = null;
        try {
          stats = fs.lstatSync(next);
        } catch (error) {
          if (error.code !== "ENOENT") {
            throw error;
          }
          missingDepth = 1;
          current = next;
        }

        if (stats !== null) {
          if (stats.isSymbolicLink()) {
            hops += 1;
            if (hops > MAX_SYMLINK_DEPTH) {
              throw new Error("Security Error: too many levels of symbolic links");
            }

            let target;
            try {
              target = fs.readlinkSync(next);
            } catch (error) {
              throw new Error(
                `Security Error: cannot inspect symlink ${next}: ${error.message}`,
              );
            }

            if (path.isAbsolute(target)) {
              const splitTarget = splitAbsolute(target);
              current = splitTarget.root;
              queue.unshift(...splitTarget.segments);
            } else {
              // A relative target is relative to the directory holding the
              // link, which is exactly "current"; prepend its segments.
              queue.unshift(...target.split(path.sep).filter(Boolean));
            }
          } else {
            current = next;
          }
        }
      }
    }
  }

  return current;
}

/**
 * Centralized utility for resolving and validating file paths within the project root.
 */
export default class PathValidator {
  /**
   * Absolute project root used as the containment boundary.
   * @returns {string} The root directory.
   */
  static getRoot() {
    return ROOT;
  }

  /**
   * Reports whether the given resolved path is the project root itself.
   * Used to forbid destructive operations on the boundary directory.
   * @param {string} resolvedPath - Absolute path to test.
   * @returns {boolean} True when the path is the root.
   */
  static isRoot(resolvedPath) {
    const absolute = path.isAbsolute(resolvedPath) ? resolvedPath : `${ROOT}${path.sep}${resolvedPath}`;
    return canonicalize(absolute) === getRealRoot();
  }

  /**
   * Resolves a path relative to the project root and ensures neither the
   * lexical path nor its OS-traversal form escapes the root. Symlinks are
   * followed even when their targets do not exist, and ".." is applied to the
   * resolved prefix so an intermediate link cannot redirect it.
   * @param {string} inputPath - The path to resolve.
   * @returns {string} Absolute path, preserving parent segments for OS traversal.
   * @throws {Error} If the path is invalid or outside of the project root.
   */
  static getSafePath(inputPath) {
    if (typeof inputPath !== "string" || inputPath.length === 0) {
      throw new Error("Security Error: path must be a non-empty string");
    }
    if (inputPath.includes("\0")) {
      throw new Error("Security Error: path contains a null byte");
    }

    const resolved = path.resolve(ROOT, inputPath);
    if (!isInside(ROOT, resolved)) {
      throw new Error("Security Error: Path is outside of project root");
    }

    // path.join/resolve would discard ".." before inspecting symlinks.
    const absolute = path.isAbsolute(inputPath) ? inputPath : `${ROOT}${path.sep}${inputPath}`;
    const canonical = canonicalize(absolute);
    if (!isInside(getRealRoot(), canonical)) {
      throw new Error("Security Error: Path resolves outside of project root");
    }

    // Keep the final symlink intact for unlink/rename semantics. Preserve ".."
    // so the operation follows the same traversal that was validated.
    return absolute.split(path.sep).includes("..") ? absolute : resolved;
  }
}
