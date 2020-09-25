const {
  constants,
  promises: { access, rename },
} = require("fs");
const { basename, dirname, extname, join } = require("path");
const { promisify } = require("util");
const { lock, unlock } = require("lockfile");
const { parseFile } = require("music-metadata");
const slugify = require("standard-slugify");

const lockPromise = promisify(lock);
const unlockPromise = promisify(unlock);

const renameWithLock = (oldPath, newPath) => {
  const lockFile = join(dirname(newPath), `${basename(newPath)}.lock`);
  return lockPromise(lockFile)
    .then(() => rename(oldPath, newPath))
    .then(() => unlockPromise(lockFile));
};

const name = (metadataTags, tags, separator) =>
  tags
    .map((tag) => {
      const value = metadataTags[tag];
      return typeof value === "object" ? Object.values(value)[0] : value;
    })
    .filter((element) => element != null)
    .join(separator);

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
  return parseFile(path).then(({ common: metadataTags }) => {
    const newPath = join(
      dirname(path),
      slugify(name(metadataTags, tags, separator), { keepCase }) + extname(path)
    );
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
