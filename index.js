const {
  constants,
  promises: { access, mkdir, rename },
} = require("fs");
const { basename, dirname, extname, join } = require("path");
const { promisify } = require("util");
const { lock, unlock } = require("lockfile");
const { parseFile } = require("music-metadata");
const slugify = require("standard-slugify");

const lockPromise = promisify(lock);
const unlockPromise = promisify(unlock);

const renameWithLock = (oldPath, newPath) => {
  const dir = dirname(newPath);
  const lockFile = join(dir, `${basename(newPath)}.lock`);
  return lockPromise(lockFile)
    .catch((error) =>
      error.code === "ENOENT"
        ? mkdir(dir, { recursive: true })
        : Promise.reject(error)
    )
    .then(() => rename(oldPath, newPath))
    .then(() => unlockPromise(lockFile));
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
module.exports = function (
  path = "",
  {
    keepCase = false,
    noop = false,
    separator = "-",
    tags = ["artist", "title"],
  } = {}
) {
  return parseFile(path).then(({ common }) => {
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
      return Promise.reject(
        Error(`Failed because '${path}' is missing all tags`)
      );
    }

    const newPath = join(dirname(path), name + extname(path));
    return path === newPath
      ? newPath
      : access(newPath, constants.F_OK).then(
          () =>
            Promise.reject(Error(`Failed because '${newPath}' already exists`)),
          () =>
            noop ? newPath : renameWithLock(path, newPath).then(() => newPath)
        );
  });
};
