import assert from "node:assert/strict";
import { execFile as execFileCb } from "node:child_process";
import {
  access,
  copyFile,
  mkdtemp,
  readdir,
  rmdir,
  unlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import { URL } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

const cli = new URL("./cli.js", import.meta.url).pathname;

const setup = async (srcs) => {
  const dir = await mkdtemp(join(tmpdir(), "test-"));
  const dests = await Promise.all(
    srcs.map(async (src) => {
      const dest = join(dir, basename(src));
      await copyFile(join(new URL(import.meta.url).pathname, "..", src), dest);
      return dest;
    }),
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
    (e) => e,
  );
  assert.equal(code, 1);
  assert.equal(stdout, "");
  assert.ok(stderr.startsWith("Usage:"));
});

test("cli with the --help option", async () => {
  const { stdout, stderr } = await execFile("node", [cli, "--help"]);
  assert.ok(stdout.startsWith("Usage:"));
  assert.equal(stderr, "");
});

test("cli with the --version option", async () => {
  const { stdout, stderr } = await execFile("node", [cli, "--version"]);
  assert.ok(stdout.startsWith("tagtoname"));
  assert.equal(stderr, "");
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
  assert.ok(stdout.includes(newPath));
  assert.equal(stderr, "");
  await assert.rejects(() => access(oldPath));
  assert.equal(await access(newPath), undefined);
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
  assert.ok(stdout.includes(newPath1));
  assert.ok(stdout.includes(newPath2));
  assert.ok(stdout.includes(newPath3));
  assert.ok(stdout.includes(newPath4));
  assert.ok(stdout.includes(newPath5));
  assert.equal(stderr, "");
  await assert.rejects(() => access(oldPath1));
  assert.equal(await access(newPath1), undefined);
  await assert.rejects(() => access(oldPath2));
  assert.equal(await access(newPath2), undefined);
  await assert.rejects(() => access(oldPath3));
  assert.equal(await access(newPath3), undefined);
  await assert.rejects(() => access(oldPath4));
  assert.equal(await access(newPath4), undefined);
  assert.equal(await access(oldPath5), undefined);
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
  assert.equal(code, 1);
  assert.ok(stdout.includes(newPath));
  assert.ok(stderr.includes(errorPath));
  assert.ok(stderr.includes(existingPath));
  assert.equal(await access(oldPath), undefined);
  await assert.rejects(() => access(newPath));
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
  assert.equal(code, 1);
  assert.ok(stdout.includes(newPath));
  assert.ok(stderr.includes(errorPath));
  assert.ok(stderr.includes(existingPath));
  assert.equal(await access(oldPath), undefined);
  await assert.rejects(() => access(newPath));
  await teardown(dir);
});
