const { exec } = require("child_process");
const { access, constants, readdir, rename, stat } = require("fs");
const EventEmmiter = require("events");
const { basename, dirname, join } = require("path");
const { promisify } = require("util");
const { lock, unlock } = require("lockfile");

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
 * - `max`: The maximum amount of concurrent ffprobe tasks to spawn, defaults to
 * `32`
 * - `noop`: Whether to perform a dry run and not rename files, defaults to
 * `false`
 * - `options`: An array of ffprobe options to pass to ffprobe, defaults to
 * `["-show_streams", "-show_format"]`
 * - `path`: The path of the ffprobe binary used to read metadata, defaults to
 * `"ffprobe"`
 * - `separator`: The separator used to split the tags in the name, defaults to
 * `"-"`
 * - `tags`: An array of tags to use in the new name of the file, defaults to
 * `["ARTIST", "artist", "TITLE", "title"]`
 * - `dest`: A custom function, which can be either sync or async, that returns
 * the destination path of a rename (the new path), with signature
 * `(oldPath, ffprobeJSON, tags, keepCase, separator) => newPath`, where
 * `oldPath` is the old path (string) of the file, `ffprobeJSON` is the JSON
 * object returned by ffprobe, the above options `tags`, `keepCase`, and
 * `separator` are the rest of arguments, the returned `newPath` is the new path
 * (string) of the file, and if it throws or rejects an `"error"` event is
 * emitted with the thrown error or rejection value
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
    max = 32,
    noop = false,
    options = ["-show_streams", "-show_format"],
    path = "ffprobe",
    separator = "-",
    tags = ["ARTIST", "artist", "TITLE", "title"],
    dest = require("./dest.js")
  } = {}
) {
  const cmd = `${path} -print_format json -loglevel error ${options.join(" ")}`;
  const renameSafely = createSafeRenamer(
    noop ? () => Promise.resolve() : renameWithLock
  );
  const emmiter = new EventEmmiter();
  const jobs = [...paths];
  let workers = 0;
  const work = path => {
    statPromise(path)
      .then(stats =>
        stats.isDirectory()
          ? readdirPromise(path).then(files =>
              files.forEach(file => jobs.push(join(path, file)))
            )
          : execPromise(`${cmd} "${path}"`)
              .then(
                ({ stdout }) =>
                  dest(path, JSON.parse(stdout), tags, keepCase, separator),
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
