const EventEmmiter = require("events");
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

const createSafeRenamer = (rename) => (oldPath, newPath) =>
  oldPath === newPath
    ? newPath
    : access(newPath, constants.F_OK)
        .then(
          () => Promise.reject(Error()),
          () => rename(oldPath, newPath)
        )
        .then(
          () => newPath,
          () => Promise.reject(Error(`${oldPath}: would override ${newPath}`))
        );

const renameWithLock = (oldPath, newPath) => {
  const pathLock = join(dirname(newPath), `${basename(newPath)}.lock`);
  return lockPromise(pathLock)
    .then(() => rename(oldPath, newPath))
    .then(() => unlockPromise(pathLock));
};

const readTags = (path) =>
  parseFile(path)
    .then(({ common }) => common)
    .catch(() => Promise.reject(Error(`${path}: could not read metadata`)));

const name = (srcTags, tags, separator) =>
  tags
    .map((tags) => {
      const value = srcTags[tags];
      return typeof value === "object" ? Object.values(value)[0] : value;
    })
    .filter((element) => element != null)
    .join(separator);

/**
 * Renames audio files using the metadata tags.
 *
 * The first argument is an array of `paths` to the files to be renamed.
 *
 * The second argument is an options object with the following properties:
 *
 * - `keepCase`: Keep the original case of the tags when renaming, defaults to
 * `false`
 * - `noop`: Whether to perform a dry run and not rename files, defaults to
 * `false`
 * - `separator`: The separator used to split the tags in the name, defaults to
 * `"-"`
 * - `tags`: An array of tags to use in the new name of the file, defaults to
 * `["artist", "title"]`
 *
 * Returns an `EventEmmiter` object with the following events:
 *
 * - `"success"`, emitted when the new path is different from the old path,
 * passing the new path (string) to the callback
 * - `"abort"`, emitted when the new path is the same as the old path,
 * passing the old path (string) to the callback
 * - `"error"`, emitted when a file cannot be renamed, passing the `Error`
 * object to the callback
 * - `"complete"`, emitted when all files have been processed
 */
module.exports = function (
  paths = [],
  {
    keepCase = false,
    noop = false,
    separator = "-",
    tags = ["artist", "title"],
  } = {}
) {
  const renameSafely = createSafeRenamer(
    noop ? () => Promise.resolve() : renameWithLock
  );
  const emmiter = new EventEmmiter();
  const jobs = [...paths];
  const work = (src) =>
    readTags(src)
      .then((srcTags) =>
        renameSafely(
          src,
          join(
            dirname(src),
            slugify(name(srcTags, tags, separator), { keepCase }) + extname(src)
          )
        )
      )
      .then((dest) => emmiter.emit(src === dest ? "abort" : "success", dest))
      .catch((error) => emmiter.emit("error", error))
      .then(() => (jobs.length > 0 ? work(jobs.pop()) : undefined));

  const workers = [];
  const workerCount = 4;
  while (jobs.length > 0 && workers.length < workerCount) {
    workers.push(work(jobs.pop()));
  }

  Promise.all(workers).then(() => emmiter.emit("complete"));
  return emmiter;
};
