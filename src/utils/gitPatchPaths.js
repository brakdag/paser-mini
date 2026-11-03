/**
 * Decodes a Git patch header's C-quoted filename as UTF-8 bytes.
 * Git quotes tabs/newlines and represents non-ASCII bytes with octal escapes.
 * @param {string} field - Header field, possibly followed by a timestamp.
 * @returns {string} Decoded filename.
 */
function decodePath(field) {
  if (!field.startsWith('"')) return field.split("\t")[0].replace(/\r$/, "");
  const match = field.match(/^"((?:[^"\\]|\\.)*)"/);
  if (!match) throw new Error("Invalid quoted patch path");
  const chunks = [];
  const encoded = match[1];
  const escapes = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, '"': 34, "\\": 92 };
  let plain = "";
  for (let i = 0; i < encoded.length; i += 1) {
    if (encoded[i] !== "\\") {
      plain += encoded[i];
    } else {
      chunks.push(Buffer.from(plain));
      plain = "";
      const octal = encoded.slice(i + 1).match(/^[0-7]{1,3}/);
      if (octal) {
        chunks.push(Buffer.from([parseInt(octal[0], 8)]));
        i += octal[0].length;
      } else {
        i += 1;
        if (!Object.hasOwn(escapes, encoded[i])) throw new Error("Invalid patch path escape");
        chunks.push(Buffer.from([escapes[encoded[i]]]));
      }
    }
  }
  chunks.push(Buffer.from(plain));
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Finds source paths that numstat omits when a patch renames or copies files.
 * Git itself parses/validates the patch first; this walk skips hunk contents so
 * deleted source lines resembling headers are not mistaken for filenames.
 * @param {string} patch - Patch already accepted by git apply --numstat.
 * @returns {Array<{path: string, mutation: boolean}>} Additional source paths.
 */
export default function gitPatchPaths(patch) {
  const paths = [];
  let oldLines = 0;
  let newLines = 0;
  let binary = false;
  patch.split("\n").forEach((line) => {
    if (oldLines > 0 || newLines > 0) {
      if (line.startsWith(" ")) { oldLines -= 1; newLines -= 1; }
      else if (line.startsWith("-")) oldLines -= 1;
      else if (line.startsWith("+")) newLines -= 1;
      return;
    }
    if (line.startsWith("diff --git ")) binary = false;
    if (line === "GIT binary patch") binary = true;
    if (binary) return;
    const hunk = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (hunk) {
      oldLines = Number(hunk[2] ?? 1);
      newLines = Number(hunk[4] ?? 1);
    } else if (line.startsWith("--- ")) {
      const filename = decodePath(line.slice(4));
      if (filename !== "/dev/null") {
        const slash = filename.indexOf("/");
        paths.push({ path: slash < 0 ? filename : filename.slice(slash + 1), mutation: true });
      }
    } else if (line.startsWith("rename from ") || line.startsWith("copy from ")) {
      const rename = line.startsWith("rename from ");
      paths.push({ path: decodePath(line.slice(rename ? 12 : 10)), mutation: rename });
    }
  });
  return paths;
}
