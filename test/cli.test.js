const { spawn } = require("child_process");
const { access, copyFile, mkdtemp, readdir, rmdir, unlink } =
  require("fs").promises;
const { tmpdir } = require("os");
const { basename, join } = require("path");

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

const setup = async (srcs) => {
  const dir = await mkdtemp(join(tmpdir(), "test-"));
  const dests = await Promise.all(
    srcs.map(async (src) => {
      const dest = join(dir, basename(src));
      await copyFile(join(__dirname, src), dest);
      return dest;
    })
  );
  return [dir, ...dests];
};

const teardown = async (dir) => {
  const files = await readdir(dir);
  await Promise.all(files.map((file) => unlink(join(dir, file))));
  return rmdir(dir);
};

test("cli with the --help option", async () => {
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
  expect(await cliOutput("--help")).toEqual({
    stdout: [help],
    stderr: [],
    exitCode: 0,
  });
  expect(await cliOutput("")).toEqual({
    stdout: [],
    stderr: [help],
    exitCode: 1,
  });
});

test("cli with the --version option", async () => {
  expect(await cliOutput("--version")).toEqual({
    stdout: [`tagtoname ${require("../package.json").version}\n`],
    stderr: [],
    exitCode: 0,
  });
});

test("cli with one operand and one option", async () => {
  const [dir, oldPath] = await setup([
    "./samples/paradise-lost-victim-of-the-past.flac",
  ]);
  const newPath = join(dir, "victim-of-the-past.flac");
  expect(await cliOutput(`-t title ${oldPath}`)).toEqual({
    stdout: [`${newPath}\n`],
    stderr: [],
    exitCode: 0,
  });
  await expect(access(oldPath)).rejects.toThrow();
  expect(await access(newPath)).toBe(undefined);
  await teardown(dir);
});

test("cli with many operands", async () => {
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
  expect(
    await cliOutput(
      `${oldPath1} ${oldPath2} ${oldPath3} ${oldPath4} ${oldPath5}`
    )
  ).toEqual({
    stdout: [
      `${newPath1}\n`,
      `${newPath2}\n`,
      `${newPath3}\n`,
      `${newPath4}\n`,
      `${newPath5}\n`,
    ],
    stderr: [],
    exitCode: 0,
  });
  await expect(access(oldPath1)).rejects.toThrow();
  expect(await access(newPath1)).toBe(undefined);
  await expect(access(oldPath2)).rejects.toThrow();
  expect(await access(newPath2)).toBe(undefined);
  await expect(access(oldPath3)).rejects.toThrow();
  expect(await access(newPath3)).toBe(undefined);
  await expect(access(oldPath4)).rejects.toThrow();
  expect(await access(newPath4)).toBe(undefined);
  expect(await access(oldPath5)).toBe(undefined);
  await teardown(dir);
});

test("cli with many operands and options", async () => {
  const [dir, oldPath, errorPath, existingPath] = await setup([
    "./samples/4-Ruun-RUUN.ogg",
    "./samples/9-Addicted-Numbered.ogg",
    "./samples/Addicted_9_Numbered.ogg",
  ]);
  const newPath = join(dir, "Ruun_4_RUUN.ogg");
  expect(
    await cliOutput(
      `-k -n -s _ -t album -t track -t title ${oldPath} ${errorPath}`
    )
  ).toEqual({
    stdout: [`${newPath}\n`],
    stderr: [`${errorPath}: Failed because '${existingPath}' already exists\n`],
    exitCode: 1,
  });
  expect(await access(oldPath)).toBe(undefined);
  await expect(access(newPath)).rejects.toThrow();
  await teardown(dir);
});

test("cli with many operands and long options", async () => {
  const [dir, oldPath, errorPath, existingPath] = await setup([
    "./samples/4-Ruun-RUUN.ogg",
    "./samples/9-Addicted-Numbered.ogg",
    "./samples/Addicted_9_Numbered.ogg",
  ]);
  const newPath = join(dir, "Ruun_4_RUUN.ogg");
  expect(
    await cliOutput(
      `--keep-case --noop --separator=_ --tag=album --tag=track --tag=title ${oldPath} ${errorPath}`
    )
  ).toEqual({
    stdout: [`${newPath}\n`],
    stderr: [`${errorPath}: Failed because '${existingPath}' already exists\n`],
    exitCode: 1,
  });
  expect(await access(oldPath)).toBe(undefined);
  await expect(access(newPath)).rejects.toThrow();
  await teardown(dir);
});
