"use strict";

const { execFile: execFileCb } = require("child_process");
const { access, copyFile, mkdtemp, readdir, rmdir, unlink } =
  require("fs").promises;
const { tmpdir } = require("os");
const { basename, join } = require("path");
const { promisify } = require("util");

const execFile = promisify(execFileCb);

const cli = join(__dirname, "../bin/cli.js");

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

test("cli with no options", async () => {
  const { code, stdout, stderr } = await execFile("node", [cli]).catch(
    (e) => e
  );
  expect(code).toBe(1);
  expect(stdout).toBe("");
  expect(stderr).toEqual(expect.stringMatching(/^Usage:/i));
});

test("cli with the --help option", async () => {
  const { stdout, stderr } = await execFile("node", [cli, "--help"]);
  expect(stdout).toEqual(expect.stringMatching(/^Usage:/i));
  expect(stderr).toBe("");
});

test("cli with the --version option", async () => {
  const { stdout, stderr } = await execFile("node", [cli, "--version"]);
  expect(stdout).toEqual(expect.stringMatching(/^tagtoname \d\.\d\.\d/));
  expect(stderr).toBe("");
});

test("cli with one operand and one option", async () => {
  const [dir, oldPath] = await setup([
    "./samples/paradise-lost-victim-of-the-past.flac",
  ]);
  const newPath = join(dir, "victim-of-the-past.flac");
  const { stdout, stderr } = await execFile("node", [
    cli,
    "-t",
    "title",
    oldPath,
  ]);
  expect(stdout).toEqual(expect.stringMatching(newPath));
  expect(stderr).toBe("");
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
  const { stdout, stderr } = await execFile("node", [
    cli,
    oldPath1,
    oldPath2,
    oldPath3,
    oldPath4,
    oldPath5,
  ]);
  expect(stdout).toEqual(expect.stringMatching(newPath1));
  expect(stdout).toEqual(expect.stringMatching(newPath2));
  expect(stdout).toEqual(expect.stringMatching(newPath3));
  expect(stdout).toEqual(expect.stringMatching(newPath4));
  expect(stdout).toEqual(expect.stringMatching(newPath5));
  expect(stderr).toBe("");
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
  const { code, stdout, stderr } = await execFile("node", [
    cli,
    "-k",
    "-n",
    "-s",
    "_",
    "-t",
    "album",
    "-t",
    "track",
    "-t",
    "title",
    oldPath,
    errorPath,
  ]).catch((e) => e);
  expect(code).toBe(1);
  expect(stdout).toEqual(expect.stringMatching(newPath));
  expect(stderr).toEqual(expect.stringMatching(errorPath));
  expect(stderr).toEqual(expect.stringMatching(existingPath));
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
  const { code, stdout, stderr } = await execFile("node", [
    cli,
    "--keep-case",
    "--noop",
    "--separator=_",
    "--tag=album",
    "--tag=track",
    "--tag=title",
    oldPath,
    errorPath,
  ]).catch((e) => e);
  expect(code).toBe(1);
  expect(stdout).toEqual(expect.stringMatching(newPath));
  expect(stderr).toEqual(expect.stringMatching(errorPath));
  expect(stderr).toEqual(expect.stringMatching(existingPath));
  expect(await access(oldPath)).toBe(undefined);
  await expect(access(newPath)).rejects.toThrow();
  await teardown(dir);
});
