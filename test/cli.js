const { spawn } = require("child_process");
const {
  access,
  copyFile,
  mkdtemp,
  readdir,
  rmdir,
  unlink,
} = require("fs").promises;
const { tmpdir } = require("os");
const { basename, dirname, join, resolve } = require("path");
const test = require("../node_modules/tape/index.js");

const cli = join(__dirname, "../bin/cli.js");

const exists = (path) =>
  access(path)
    .then(() => true)
    .catch(() => false);

const tagtonamePromise = (args, options) =>
  new Promise((resolve, reject) => {
    const stdout = [];
    const stderr = [];
    const tags2name = spawn(
      "node",
      [cli, ...(args ? args.split(/\s+/u) : [])],
      options
    );
    tags2name.on("close", (exitCode) => resolve({ stdout, stderr, exitCode }));
    tags2name.on("error", (error) => reject(error));
    tags2name.stdout.on("data", (data) => stdout.push(data.toString()));
    tags2name.stderr.on("data", (data) => stderr.push(data.toString()));
  });

const setup = (srcs) =>
  mkdtemp(join(tmpdir(), "test-")).then((dir) =>
    Promise.all(
      srcs.map((src) => {
        const dest = join(dir, basename(src));
        return copyFile(join(__dirname, src), dest).then(() => dest);
      })
    ).then((dests) => [dir, ...dests])
  );

const teardown = (dir) =>
  readdir(dir)
    .then((files) => Promise.all(files.map((file) => unlink(join(dir, file)))))
    .then(() => rmdir(dir));

test("cli with --help", async ({ deepEqual, end }) => {
  const helpMessage = `Usage: tagtoname [-k] [-n] [-s separator] [-t tag]... file...

Renames audio files using the metadata tags.

Options:

  -k, --keep-case            Keep the original case of the tags when renaming
  -n, --noop                 Dry run, show new paths without renaming the files
  -s, --separator=SEPARATOR  Split tags with SEPARATOR;
                             defaults to -s-
  -t, --tag=TAG              Append TAG(s) to the new name;
                             defaults to -t artist -t title
  --help                     Show help
  --version                  Output the version number

For example, by default a file with the "mp3" ext, the artist tag "Beethoven",
and the title tag "Ode to Joy" is renamed to "beethoven-ode-to-joy.mp3".
`;
  deepEqual(
    await tagtonamePromise("--help"),
    { stdout: [helpMessage], stderr: [], exitCode: 0 },
    "logs the help message to stdout and exits with success"
  );
  deepEqual(
    await tagtonamePromise(""),
    { stdout: [], stderr: [helpMessage], exitCode: 1 },
    "logs the help message to stderr and exits with error given no arguments"
  );
  end();
});

test("cli with --version", async ({ deepEqual, end }) => {
  deepEqual(
    await tagtonamePromise("--version"),
    {
      stdout: [`tagtoname ${require("../package.json").version}\n`],
      stderr: [],
      exitCode: 0,
    },
    "logs the version of tagtoname to stdout and exits with success"
  );
  end();
});

test("cli with one option and a file", async ({ deepEqual, equal, end }) => {
  const [dir, oldPath] = await setup([
    "./samples/paradise-lost-victim-of-the-past.flac",
  ]);
  const newPath = resolve(dir, "victim-of-the-past.flac");
  deepEqual(
    await tagtonamePromise(`-t title ${oldPath}`),
    { stdout: [`${newPath}\n`], stderr: [], exitCode: 0 },
    "logs the new path to stdout and exits with success"
  );
  equal(await exists(oldPath), false, "deletes the old path");
  equal(await exists(newPath), true, "creates the new path");
  await teardown(dir);
  end();
});

test("cli with many options and files", async ({ deepEqual, equal, end }) => {
  const [dir, oldPath, errorPath, existingPath] = await setup([
    "./samples/4-Ruun-RUUN.ogg",
    "./samples/9-Addicted-Numbered.ogg",
    "./samples/Addicted--9--Numbered.ogg",
  ]);
  const newPath = `${join(dirname(oldPath), "Ruun--4--RUUN.ogg")}`;
  deepEqual(
    await tagtonamePromise(
      `-k -n -s-- -t album -t track -t title ${oldPath} ${errorPath}`
    ),
    {
      stdout: [`${newPath}\n`],
      stderr: [`${errorPath}: would override ${existingPath}\n`],
      exitCode: 1,
    },
    "logs the new path to stdout, logs the error to stderr, and exists with error"
  );
  equal(await exists(oldPath), true, "does not delete the old path");
  equal(await exists(newPath), false, "does not create the new path");
  await teardown(dir);
  end();
});

test("cli with many long options and files", async ({
  deepEqual,
  equal,
  end,
}) => {
  const [dir, oldPath, errorPath, existingPath] = await setup([
    "./samples/4-Ruun-RUUN.ogg",
    "./samples/9-Addicted-Numbered.ogg",
    "./samples/Addicted--9--Numbered.ogg",
  ]);
  const newPath = `${join(dirname(oldPath), "Ruun--4--RUUN.ogg")}`;
  deepEqual(
    await tagtonamePromise(
      `--keep-case --noop --separator=-- --tag=album --tag=track --tag=title ${oldPath} ${errorPath}`
    ),
    {
      stdout: [`${newPath}\n`],
      stderr: [`${errorPath}: would override ${existingPath}\n`],
      exitCode: 1,
    },
    "logs the new path to stdout, logs the error to stderr, and exists with error"
  );
  equal(await exists(oldPath), true, "does not delete the old path");
  equal(await exists(newPath), false, "does not create the new path");
  await teardown(dir);
  end();
});
