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

export default async function (
  path = "",
  {
    keepCase = false,
    noop = false,
    separator = "-",
    tags = ["artist", "title"],
  } = {},
) {
  let common;
  try {
    ({ common } = await parseFile(path));
  } catch (error) {
    if (error.message.includes("ENOENT")) {
      throw Error(`Failed because '${path}' does not exist`);
    } else {
      throw Error(`Failed to parse file '${path}'`);
    }
  }
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
