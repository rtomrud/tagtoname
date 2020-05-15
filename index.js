const { execFile } = require("child_process");
const {
  constants,
  promises: { access, rename },
} = require("fs");
const EventEmmiter = require("events");
const { cpus } = require("os");
const { basename, dirname, extname, join } = require("path");
const { promisify } = require("util");
const { lock, unlock } = require("lockfile");
const slugify = require("standard-slugify");

const execFilePromise = promisify(execFile);
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

const readMetadata = (path) =>
  execFilePromise("ffprobe", [
    "-loglevel",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    `${path}`,
  ]).then(
    ({ stdout }) => {
      const {
        format: { tags = {} },
        streams,
      } = JSON.parse(stdout);
      return Object.assign(
        streams.reduce(
          (streamTags, { tags }) => Object.assign(streamTags, tags),
          {}
        ),
        tags
      );
    },
    ({ stderr }) => Promise.reject(Error(stderr.trim()))
  );

const name = (metadata, selectedTags, separator) =>
  selectedTags
    .map((selectedTag) => metadata[selectedTag])
    .filter((element) => element != null)
    .join(separator);

/**
 * Renames audio or video files using their metadata tags.
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
 * `["ARTIST", "artist", "TITLE", "title"]`
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
    tags = ["ARTIST", "artist", "TITLE", "title"],
  } = {}
) {
  const renameSafely = createSafeRenamer(
    noop ? () => Promise.resolve() : renameWithLock
  );
  const emmiter = new EventEmmiter();
  const jobs = [...paths];
  const work = (path) =>
    path == null
      ? Promise.resolve()
      : readMetadata(path)
          .then((metadata) =>
            renameSafely(
              path,
              join(
                dirname(path),
                slugify(name(metadata, tags, separator), { keepCase }) +
                  extname(path)
              )
            )
          )
          .then((newPath) =>
            emmiter.emit(path === newPath ? "abort" : "success", newPath)
          )
          .catch((error) => emmiter.emit("error", error))
          .then(() => work(jobs.pop()));

  const workers = [];
  const workerCount = cpus().length;
  while (jobs.length > 0 && workers.length < workerCount) {
    workers.push(work(jobs.pop()));
  }

  Promise.all(workers).then(() => emmiter.emit("complete"));
  return emmiter;
};
