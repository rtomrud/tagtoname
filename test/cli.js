const { exec, spawn } = require("child_process");
const { access, mkdtemp, readdir, rmdir, unlink } = require("fs").promises;
const { tmpdir } = require("os");
const { dirname, extname, join, resolve } = require("path");
const test = require("../node_modules/tape/index.js");

const cli = join(__dirname, "../bin/cli.js");

const exists = path =>
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
    tags2name.on("close", exitCode => resolve({ stdout, stderr, exitCode }));
    tags2name.on("error", error => reject(error));
    tags2name.stdout.on("data", data => stdout.push(data.toString()));
    tags2name.stderr.on("data", data => stderr.push(data.toString()));
  });

const setup = files =>
  mkdtemp(join(tmpdir(), "test-")).then(dir =>
    Promise.all(
      Object.entries(files).map(
        ([path, { format: { tags = {} } = {} } = {}]) => {
          const codec = {
            ".flac": "flac",
            ".opus": "libopus",
            ".ogg": "libvorbis",
            ".m4a": "aac",
            ".mp3": "libmp3lame"
          }[extname(path)];
          const containerMetadata = Object.entries(tags)
            .map(([key, value]) => `-metadata ${key}="${value}"`)
            .join(" ");
          const newPath = join(dir, path);
          return new Promise((resolve, reject) =>
            exec(
              `ffmpeg -f lavfi -i anullsrc -t 1 -c:a ${codec} ${containerMetadata} ${newPath}`,
              error => (error ? reject(error) : resolve(newPath))
            )
          );
        }
      )
    ).then(paths => [dir, ...paths])
  );

const teardown = dir =>
  readdir(dir)
    .then(files => Promise.all(files.map(file => unlink(join(dir, file)))))
    .then(() => rmdir(dir));

test("cli with --help", async ({ deepEqual, end }) => {
  const helpMessage = `Usage: tagtoname [-k] [-n] [-s separator] [-t tag]... path...

Renames the files at path(s) to a URL-safe name using the metadata tag(s).

Options:

  -k, --keep-case            Keep the case from the tags when renaming
  -n, --noop                 Dry run, show new paths without renaming the files
  -s, --separator=SEPARATOR  Split tags with SEPARATOR;
                             defaults to -s-
  -t, --tag=TAG              Append TAG(s) to the new name;
                             defaults to -t ARTIST -t artist -t TITLE -t title
  --help                     Show help
  --version                  Output the version number

For example, by default a file with the "mp3" ext, the ARTIST tag "Beethoven",
and the TITLE tag "Ode to Joy" is renamed to "beethoven-ode-to-joy.mp3".
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
      exitCode: 0
    },
    "logs the version of tagtoname and ffprobe to stdout and exits with success"
  );
  end();
});

test("cli with a file that should be renamed", async ({
  deepEqual,
  equal,
  end
}) => {
  const [dir, oldPath] = await setup({
    "file.flac": {
      format: { tags: { ARTIST: "Paradise Lost", TITLE: "Victim Of The Past" } }
    }
  });
  const newPath = resolve(dir, "paradise-lost-victim-of-the-past.flac");
  deepEqual(
    await tagtonamePromise(oldPath),
    { stdout: [`${newPath}\n`], stderr: [], exitCode: 0 },
    "logs the new path to stdout and exits with success"
  );
  equal(await exists(oldPath), false, "deletes the old path");
  equal(await exists(newPath), true, "creates the new path");
  await teardown(dir);
  end();
});

test("cli with options and many files", async ({ deepEqual, equal, end }) => {
  const [dir, oldPath, errorPath, existingPath] = await setup({
    "rename.ogg": {
      format: { tags: { ALBUM: "Ruun", TITLE: "RUUN", track: "04" } }
    },
    "duplicate.ogg": {
      format: { tags: { ALBUM: "Addicted", TITLE: "Numbered!", track: "09" } }
    },
    "Addicted--09--Numbered.ogg": {}
  });
  const newPath = `${join(dirname(oldPath), "Ruun--04--RUUN.ogg")}`;
  deepEqual(
    await tagtonamePromise(
      `-k -m 1 -n -o-show_streams -o-select_streams -o a:0 -p ffprobe -s-- -t ALBUM -t track -t TITLE ${oldPath} ${errorPath}`
    ),
    {
      stdout: [`${newPath}\n`],
      stderr: [`${errorPath}: would override ${existingPath}\n`],
      exitCode: 1
    },
    "logs the new path to stdout, logs the error to stderr, and exists with error"
  );
  equal(await exists(oldPath), true, "does not delete the old path");
  equal(await exists(newPath), false, "does not create the new path");
  await teardown(dir);
  end();
});

test("cli with long options and many files", async ({
  deepEqual,
  equal,
  end
}) => {
  const [dir, oldPath, errorPath, existingPath] = await setup({
    "rename.ogg": {
      format: { tags: { ALBUM: "Ruun", TITLE: "RUUN", track: "04" } }
    },
    "duplicate.ogg": {
      format: { tags: { ALBUM: "Addicted", TITLE: "Numbered!", track: "09" } }
    },
    "Addicted--09--Numbered.ogg": {}
  });
  const newPath = `${join(dirname(oldPath), "Ruun--04--RUUN.ogg")}`;
  deepEqual(
    await tagtonamePromise(
      `--keep-case --max=1 --noop --option=-show_streams --option=-select_streams --option=a:0 --path=ffprobe --separator=-- --tag=ALBUM --tag=track --tag=TITLE ${oldPath} ${errorPath}`
    ),
    {
      stdout: [`${newPath}\n`],
      stderr: [`${errorPath}: would override ${existingPath}\n`],
      exitCode: 1
    },
    "logs the new path to stdout, logs the error to stderr, and exists with error"
  );
  equal(await exists(oldPath), true, "does not delete the old path");
  equal(await exists(newPath), false, "does not create the new path");
  await teardown(dir);
  end();
});

test("cli with one option of each repeatable option", async ({
  deepEqual,
  equal,
  end
}) => {
  const [dir, oldPath] = await setup({
    "file.ogg": {
      format: { tags: { ARTIST: "Paradise Lost", TITLE: "Victim Of The Past" } }
    }
  });
  const newPath = resolve(dir, "victim-of-the-past.ogg");
  deepEqual(
    await tagtonamePromise(`-o-show_streams -t TITLE ${oldPath}`),
    { stdout: [`${newPath}\n`], stderr: [], exitCode: 0 },
    "logs the new path to stdout and exits with success"
  );
  equal(await exists(oldPath), false, "deletes the old path");
  equal(await exists(newPath), true, "creates the new path");
  await teardown(dir);
  end();
});
