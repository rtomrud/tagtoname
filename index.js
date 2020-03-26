const { exec } = require("child_process");
const { access, constants, readdir, rename, stat } = require("fs");
const EventEmmiter = require("events");
const { cpus } = require("os");
const { basename, dirname, extname, join } = require("path");
const { promisify } = require("util");
const { lock, unlock } = require("lockfile");
const slugify = require("standard-slugify");

const execPromise = promisify(exec);
const accessPromise = promisify(access);
const readdirPromise = promisify(readdir);
const renamePromise = promisify(rename);
const statPromise = promisify(stat);
const lockPromise = promisify(lock);
const unlockPromise = promisify(unlock);

const createSafeRenamer = renamePromise => (oldPath, newPath) =>
  oldPath === newPath
    ? newPath
    : accessPromise(newPath, constants.F_OK)
        .then(
          () => Promise.reject(Error()),
          () => renamePromise(oldPath, newPath)
        )
        .then(
          () => newPath,
          () => Promise.reject(Error(`${oldPath}: would override ${newPath}`))
        );

const renameWithLock = (oldPath, newPath) => {
  const pathLock = join(dirname(newPath), `${basename(newPath)}.lock`);
  return lockPromise(pathLock)
    .then(() => renamePromise(oldPath, newPath))
    .then(() => unlockPromise(pathLock));
};

const name = (
  { format: { tags: formatTags = {} }, streams },
  tags,
  separator
) => {
  const metadataTags = Object.assign(
    streams.reduce(
      (streamTags, { tags }) => Object.assign(streamTags, tags),
      {}
    ),
    formatTags
  );
  return tags
    .map(tag => metadataTags[tag])
    .filter(element => element != null)
    .join(separator);
};

/**
 * Renames audio or video files using their metadata tags.
 *
 * The given `paths` can be paths to files or directories, in which case it
 * recursively traverses them.
 *
 * The second argument is an options object with the following properties:
 *
 * - `keepCase`: Keep the case from the tags when renaming, defaults to
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
 * - `"rename"`, emitted when the new path is different from the old path,
 * passing the new path (string) to the callback
 * - `"same"`, emitted when the new path is the same as the old path,
 * passing the old path (string) to the callback
 * - `"error"`, emitted when a file cannot be renamed, passing the `Error`
 * object to the callback
 * - `"done"`, emitted when all files have been processed
 */
module.exports = function(
  paths = [],
  {
    keepCase = false,
    noop = false,
    separator = "-",
    tags = ["ARTIST", "artist", "TITLE", "title"]
  } = {}
) {
  const renameSafely = createSafeRenamer(
    noop ? () => Promise.resolve() : renameWithLock
  );
  const emmiter = new EventEmmiter();
  const jobs = [...paths];
  const max = cpus().length * 2;
  let workers = 0;
  const work = path => {
    statPromise(path)
      .then(stats =>
        stats.isDirectory()
          ? readdirPromise(path).then(files =>
              files.forEach(file => jobs.push(join(path, file)))
            )
          : execPromise(
              `ffprobe -print_format json -show_format -show_streams -loglevel error "${path}"`
            )
              .then(
                ({ stdout }) =>
                  join(
                    dirname(path),
                    `${slugify(name(JSON.parse(stdout), tags, separator), {
                      keepCase
                    })}${extname(path)}`
                  ),
                ({ stderr }) => Promise.reject(Error(stderr.trim()))
              )
              .then(newPath => renameSafely(path, newPath))
              .then(newPath =>
                emmiter.emit(path === newPath ? "same" : "rename", newPath)
              )
      )
      .catch(error => emmiter.emit("error", error))
      .then(() => {
        workers -= 1;
        if (jobs.length === 0 && workers === 0) {
          emmiter.emit("done");
        } else {
          while (jobs.length > 0 && workers < max) {
            work(jobs.pop());
            workers += 1;
          }
        }
      });
  };

  if (jobs.length > 0 && max > 0) {
    while (jobs.length > 0 && workers < max) {
      work(jobs.pop());
      workers += 1;
    }
  } else {
    setTimeout(() => emmiter.emit("done"), 0);
  }

  return emmiter;
};
