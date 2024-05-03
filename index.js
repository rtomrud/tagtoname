import { constants } from "node:fs";
import { access, mkdir, rename } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { promisify } from "node:util";
import { lock as lockCb, unlock as unlockCb } from "lockfile";
import { parseFile } from "music-metadata";
import slugify from "standard-slugify";

const lock = promisify(lockCb);
const unlock = promisify(unlockCb);

const exists = async (path) => {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

/**
 * Renames an audio file using its metadata tags. Resolves with the new path.
 *
 * The first argument is the `path` of the file to be renamed.
 *
 * The second argument is an options object with the following properties:
 *
 * - `keepCase`: Keep the original case of the tags when renaming,
 * defaults to `false`
 * - `noop`: Perform a dry run without renaming the file,
 * defaults to `false`
 * - `separator`: The separator used to split the tags in the new name,
 * defaults to `"-"`
 * - `tags`: An array of the tags used in the new name,
 * defaults to `["artist", "title"]`
 */
export default async function (
  path = "",
  {
    keepCase = false,
    noop = false,
    separator = "-",
    tags = ["artist", "title"],
  } = {}
) {
  const { common } = await parseFile(path);
  const name = tags
    .reduce((tags, key) => {
      const value = common[key];
      const tag = typeof value === "object" ? Object.values(value)[0] : value;
      if (tag != null) {
        tags.push(slugify(String(tag), { keepCase }));
      }

      return tags;
    }, [])
    .join(separator);
  if (name === "") {
    throw Error(`Failed because '${path}' is missing all tags`);
  }

  const newPath = join(dirname(path), name + extname(path));
  if (path === newPath) {
    return newPath;
  }

  if (await exists(newPath)) {
    throw Error(`Failed because '${newPath}' already exists`);
  }

  if (noop) {
    return newPath;
  }

  const dir = dirname(newPath);
  const lockFile = join(dir, `${basename(newPath)}.lock`);
  try {
    await lock(lockFile);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    await mkdir(dir, { recursive: true });
    await lock(lockFile);
  }

  await rename(path, newPath);
  await unlock(lockFile);
  return newPath;
}
