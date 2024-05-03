import assert from "node:assert/strict";
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
import tagtoname from "./index.js";

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
  const files = await readdir(dir, { withFileTypes: true });
  await Promise.all(
    files.map(async (file) => {
      const path = join(dir, file.name);
      return file.isDirectory() ? teardown(path) : unlink(path);
    }),
  );
  return rmdir(dir);
};

test("tagtoname without a path", async () => {
  await assert.rejects(() => tagtoname(), {
    message: "ENOENT: no such file or directory, stat ''",
  });
});

test("tagtoname without options", async () => {
  const [dir, oldPath] = await setup([
    "./samples/Paradise-Lost-Victim-Of-The-Past.flac",
  ]);
  const newPath = join(dir, "paradise-lost-victim-of-the-past.flac");
  assert.equal(await tagtoname(oldPath), newPath);
  await assert.rejects(() => access(oldPath));
  assert.equal(await access(newPath), undefined);
  await teardown(dir);
});

test("tagtoname without options and with a file that already exists", async () => {
  const [dir, oldPath] = await setup([
    "./samples/paradise-lost-victim-of-the-past.flac",
  ]);
  assert.equal(await tagtoname(oldPath), oldPath);
  assert.equal(await access(oldPath), undefined);
  await teardown(dir);
});

test("tagtoname with the keepCase option", async () => {
  const [dir, oldPath] = await setup([
    "./samples/paradise-lost-victim-of-the-past.flac",
  ]);
  const newPath = join(dir, "Paradise-Lost-Victim-Of-The-Past.flac");
  assert.equal(await tagtoname(oldPath, { keepCase: true }), newPath);
  await assert.rejects(() => access(oldPath));
  assert.equal(await access(newPath), undefined);
  await teardown(dir);
});

test("tagtoname with the noop option", async () => {
  const [dir, oldPath] = await setup([
    "./samples/Paradise-Lost-Victim-Of-The-Past.flac",
  ]);
  const newPath = join(dir, "paradise-lost-victim-of-the-past.flac");
  assert.equal(await tagtoname(oldPath, { noop: true }), newPath);
  assert.equal(await access(oldPath), undefined);
  await assert.rejects(() => access(newPath));
  await teardown(dir);
});

test("tagtoname with the separator option", async () => {
  const [dir, oldPath] = await setup([
    "./samples/Paradise-Lost-Victim-Of-The-Past.flac",
  ]);
  const newPath = join(dir, "paradise-lost/victim-of-the-past.flac");
  assert.equal(await tagtoname(oldPath, { separator: "/" }), newPath);
  await assert.rejects(() => access(oldPath));
  assert.equal(await access(newPath), undefined);
  await teardown(dir);
});

test("tagtoname with the tags option", async () => {
  const [dir, oldPath] = await setup(["./samples/9-Addicted-Numbered.ogg"]);
  const newPath = join(dir, "addicted-9-numbered.ogg");
  assert.equal(
    await tagtoname(oldPath, { tags: ["album", "track", "title"] }),
    newPath,
  );
  await assert.rejects(() => access(oldPath));
  assert.equal(await access(newPath), undefined);
  await teardown(dir);
});

test("tagtoname with the tags option and a missing tag", async () => {
  const [dir, oldPath] = await setup(["./samples/9-Addicted-Numbered.ogg"]);
  const newPath = join(dir, "addicted-numbered.ogg");
  assert.equal(
    await tagtoname(oldPath, { tags: ["genre", "album", "title"] }),
    newPath,
  );
  await assert.rejects(() => access(oldPath));
  assert.equal(await access(newPath), undefined);
  await teardown(dir);
});

test("tagtoname with the tags option but all tags missing", async () => {
  const [dir, oldPath] = await setup([
    "./samples/paradise-lost-victim-of-the-past.flac",
  ]);
  const newPath = join(dir, ".flac");
  await assert.rejects(
    async () => {
      await tagtoname(oldPath, { tags: ["album", "track"] });
    },
    { message: `Failed because '${oldPath}' is missing all tags` },
  );
  assert.equal(await access(oldPath), undefined);
  await assert.rejects(() => access(newPath));
  await teardown(dir);
});

test("tagtoname with a file that would override another file", async () => {
  const [dir, oldPath, newPath] = await setup([
    "./samples/Paradise-Lost-Victim-Of-The-Past.flac",
    "./samples/paradise-lost-victim-of-the-past.flac",
  ]);
  await assert.rejects(() => tagtoname(oldPath), {
    message: `Failed because '${newPath}' already exists`,
  });
  assert.equal(await access(oldPath), undefined);
  await teardown(dir);
});

test("tagtoname with a locked file", async () => {
  const [dir, oldPath, lockPath] = await setup([
    "./samples/Paradise-Lost-Victim-Of-The-Past.flac",
    "./samples/paradise-lost-victim-of-the-past.flac.lock",
  ]);
  const newPath = join(dir, "paradise-lost-victim-of-the-past.flac");
  await assert.rejects(() => tagtoname(oldPath), {
    message: `EEXIST: file already exists, open '${lockPath}'`,
  });
  assert.equal(await access(oldPath), undefined);
  await assert.rejects(() => access(newPath));
  await teardown(dir);
});

test("tagtoname with a path that does not exist", async () => {
  const [dir] = await setup([]);
  const oldPath = join(dir, "null");
  await assert.rejects(() => tagtoname(oldPath), {
    message: `ENOENT: no such file or directory, stat '${oldPath}'`,
  });
  await teardown(dir);
});

test("tagtoname with a file without metadata", async () => {
  const [dir, oldPath] = await setup(["./samples/empty"]);
  await assert.rejects(() => tagtoname(oldPath), {
    message: "Failed to determine audio format",
  });
  assert.equal(await access(oldPath), undefined);
  await teardown(dir);
});
