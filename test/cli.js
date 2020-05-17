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
const { basename, join } = require("path");
const test = require("../node_modules/tape/index.js");

const cli = join(__dirname, "../bin/cli.js");

const cliOutput = (args) =>
  new Promise((resolve, reject) => {
    const stdout = [];
    const stderr = [];
    const tags2name = spawn("node", [cli, ...(args ? args.split(/\s+/) : [])]);
    tags2name.on("close", (exitCode) =>
      resolve({ stdout: stdout.sort(), stderr: stderr.sort(), exitCode })
    );
    tags2name.on("error", reject);
    tags2name.stdout.on("data", (data) => stdout.push(data.toString()));
    tags2name.stderr.on("data", (data) => stderr.push(data.toString()));
  });

const exists = (path) =>
  access(path)
    .then(() => true)
    .catch(() => false);

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

test("cli with the --help option", async ({ deepEqual, end }) => {
  const help = `Usage: tagtoname [-k] [-n] [-s separator] [-t tag]... file...

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
    await cliOutput("--help"),
    { stdout: [help], stderr: [], exitCode: 0 },
    "logs the help message to stdout and exits with success"
  );
  deepEqual(
    await cliOutput(""),
    { stdout: [], stderr: [help], exitCode: 1 },
    "logs the help message to stderr and exits with error given no arguments"
  );
  end();
});

test("cli with the --version option", async ({ deepEqual, end }) => {
  deepEqual(
    await cliOutput("--version"),
    {
      stdout: [`tagtoname ${require("../package.json").version}\n`],
      stderr: [],
      exitCode: 0,
    },
    "logs the version of tagtoname to stdout and exits with success"
  );
  end();
});

test("cli with one operand and one option", async ({
  deepEqual,
  equal,
  end,
}) => {
  const [dir, oldPath] = await setup([
    "./samples/paradise-lost-victim-of-the-past.flac",
  ]);
  const newPath = join(dir, "victim-of-the-past.flac");
  deepEqual(
    await cliOutput(`-t title ${oldPath}`),
    { stdout: [`${newPath}\n`], stderr: [], exitCode: 0 },
    "logs the new path to stdout and exits with success"
  );
  equal(await exists(oldPath), false, "deletes the old path");
  equal(await exists(newPath), true, "creates the new path");
  await teardown(dir);
  end();
});

test("cli with many operands", async ({ deepEqual, equal, end }) => {
  const [dir, oldPath1, oldPath2, oldPath3, oldPath4, oldPath5] = await setup([
    "./samples/Carnivore-Five-Billion-Dead.opus",
    "./samples/Killing-Joke-On-All-Hallows-Eve.mp3",
    "./samples/Mr-Bungle-Quote-Unquote.ogg",
    "./samples/Strapping-Young-Lad-Skeksis.m4a",
    "./samples/paradise-lost-victim-of-the-past.flac",
  ]);
  const newPath1 = join(dir, "carnivore-five-billion-dead.opus");
  const newPath2 = join(dir, "killing-joke-on-all-hallows-eve.mp3");
  const newPath3 = join(dir, "mr-bungle-quote-unquote.ogg");
  const newPath5 = join(dir, "strapping-young-lad-skeksis.m4a");
  const newPath4 = join(dir, "paradise-lost-victim-of-the-past.flac");
  deepEqual(
    await cliOutput(
      `${oldPath1} ${oldPath2} ${oldPath3} ${oldPath4} ${oldPath5}`
    ),
    {
      stdout: [
        `${newPath1}\n`,
        `${newPath2}\n`,
        `${newPath3}\n`,
        `${newPath4}\n`,
        `${newPath5}\n`,
      ],
      stderr: [],
      exitCode: 0,
    },
    "logs the new path to stdout, the error to stderr, and exists with error"
  );
  equal(await exists(oldPath1), false, "deletes the 1st old path");
  equal(await exists(newPath1), true, "creates the 1st new path");
  equal(await exists(oldPath2), false, "deletes the 2nd old path");
  equal(await exists(newPath2), true, "creates the 2nd new path");
  equal(await exists(oldPath3), false, "deletes the 3rd old path");
  equal(await exists(newPath3), true, "creates the 3rd new path");
  equal(await exists(oldPath4), false, "deletes the 4th old path");
  equal(await exists(newPath4), true, "creates the 4th new path");
  equal(await exists(oldPath5), true, "does not delete the unchanged old path");
  await teardown(dir);
  end();
});

test("cli with many operands and options", async ({
  deepEqual,
  equal,
  end,
}) => {
  const [dir, oldPath, errorPath, existingPath] = await setup([
    "./samples/4-Ruun-RUUN.ogg",
    "./samples/9-Addicted-Numbered.ogg",
    "./samples/Addicted--9--Numbered.ogg",
  ]);
  const newPath = join(dir, "Ruun--4--RUUN.ogg");
  deepEqual(
    await cliOutput(
      `-k -n -s-- -t album -t track -t title ${oldPath} ${errorPath}`
    ),
    {
      stdout: [`${newPath}\n`],
      stderr: [
        `${errorPath}: Failed because '${existingPath}' already exists\n`,
      ],
      exitCode: 1,
    },
    "logs the new path to stdout, the error to stderr, and exists with error"
  );
  equal(await exists(oldPath), true, "does not delete the old path");
  equal(await exists(newPath), false, "does not create the new path");
  await teardown(dir);
  end();
});

test("cli with many operands and long options", async ({
  deepEqual,
  equal,
  end,
}) => {
  const [dir, oldPath, errorPath, existingPath] = await setup([
    "./samples/4-Ruun-RUUN.ogg",
    "./samples/9-Addicted-Numbered.ogg",
    "./samples/Addicted--9--Numbered.ogg",
  ]);
  const newPath = join(dir, "Ruun--4--RUUN.ogg");
  deepEqual(
    await cliOutput(
      `--keep-case --noop --separator=-- --tag=album --tag=track --tag=title ${oldPath} ${errorPath}`
    ),
    {
      stdout: [`${newPath}\n`],
      stderr: [
        `${errorPath}: Failed because '${existingPath}' already exists\n`,
      ],
      exitCode: 1,
    },
    "logs the new path to stdout, the error to stderr, and exists with error"
  );
  equal(await exists(oldPath), true, "does not delete the old path");
  equal(await exists(newPath), false, "does not create the new path");
  await teardown(dir);
  end();
});
