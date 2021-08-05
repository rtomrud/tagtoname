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
const tagtoname = require("../index.js");

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
  const files = await readdir(dir, { withFileTypes: true });
  await Promise.all(
    files.map(async (file) => {
      const path = join(dir, file.name);
      return file.isDirectory() ? teardown(path) : unlink(path);
    })
  );
  return rmdir(dir);
};

test("tagtoname without a path", async () => {
  await expect(tagtoname()).rejects.toThrow(
    "ENOENT: no such file or directory, stat ''"
  );
});

test("tagtoname without options", async () => {
  const [dir, oldPath] = await setup([
    "./samples/Paradise-Lost-Victim-Of-The-Past.flac",
  ]);
  const newPath = join(dir, "paradise-lost-victim-of-the-past.flac");
  expect(await tagtoname(oldPath)).toBe(newPath);
  await expect(access(oldPath)).rejects.toThrow();
  expect(await access(newPath)).toBe(undefined);
  await teardown(dir);
});

test("tagtoname without options and with a file that already exists", async () => {
  const [dir, oldPath] = await setup([
    "./samples/paradise-lost-victim-of-the-past.flac",
  ]);
  expect(await tagtoname(oldPath)).toBe(oldPath);
  expect(await access(oldPath)).toBe(undefined);
  await teardown(dir);
});

test("tagtoname with the keepCase option", async () => {
  const [dir, oldPath] = await setup([
    "./samples/paradise-lost-victim-of-the-past.flac",
  ]);
  const newPath = join(dir, "Paradise-Lost-Victim-Of-The-Past.flac");
  expect(await tagtoname(oldPath, { keepCase: true })).toBe(newPath);
  await expect(access(oldPath)).rejects.toThrow();
  expect(await access(newPath)).toBe(undefined);
  await teardown(dir);
});

test("tagtoname with the noop option", async () => {
  const [dir, oldPath] = await setup([
    "./samples/Paradise-Lost-Victim-Of-The-Past.flac",
  ]);
  const newPath = join(dir, "paradise-lost-victim-of-the-past.flac");
  expect(await tagtoname(oldPath, { noop: true })).toBe(newPath);
  expect(await access(oldPath)).toBe(undefined);
  await expect(access(newPath)).rejects.toThrow();
  await teardown(dir);
});

test("tagtoname with the separator option", async () => {
  const [dir, oldPath] = await setup([
    "./samples/Paradise-Lost-Victim-Of-The-Past.flac",
  ]);
  const newPath = join(dir, "paradise-lost/victim-of-the-past.flac");
  expect(await tagtoname(oldPath, { separator: "/" })).toBe(newPath);
  await expect(access(oldPath)).rejects.toThrow();
  expect(await access(newPath)).toBe(undefined);
  await teardown(dir);
});

test("tagtoname with the tags option", async () => {
  const [dir, oldPath] = await setup(["./samples/9-Addicted-Numbered.ogg"]);
  const newPath = join(dir, "addicted-9-numbered.ogg");
  expect(await tagtoname(oldPath, { tags: ["album", "track", "title"] })).toBe(
    newPath
  );
  await expect(access(oldPath)).rejects.toThrow();
  expect(await access(newPath)).toBe(undefined);
  await teardown(dir);
});

test("tagtoname with the tags option and a missing tag", async () => {
  const [dir, oldPath] = await setup(["./samples/9-Addicted-Numbered.ogg"]);
  const newPath = join(dir, "addicted-numbered.ogg");
  expect(await tagtoname(oldPath, { tags: ["genre", "album", "title"] })).toBe(
    newPath
  );
  await expect(access(oldPath)).rejects.toThrow();
  expect(await access(newPath)).toBe(undefined);
  await teardown(dir);
});

test("tagtoname with the tags option but all tags missing", async () => {
  const [dir, oldPath] = await setup([
    "./samples/paradise-lost-victim-of-the-past.flac",
  ]);
  const newPath = join(dir, ".flac");
  await expect(
    tagtoname(oldPath, { tags: ["album", "track"] })
  ).rejects.toThrow(`Failed because '${oldPath}' is missing all tags`);
  expect(await access(oldPath)).toBe(undefined);
  await expect(access(newPath)).rejects.toThrow();
  await teardown(dir);
});

test("tagtoname with a file that would override another file", async () => {
  const [dir, oldPath, newPath] = await setup([
    "./samples/Paradise-Lost-Victim-Of-The-Past.flac",
    "./samples/paradise-lost-victim-of-the-past.flac",
  ]);
  await expect(tagtoname(oldPath)).rejects.toThrow(
    `Failed because '${newPath}' already exists`
  );
  expect(await access(oldPath)).toBe(undefined);
  await teardown(dir);
});

test("tagtoname with a locked file", async () => {
  const [dir, oldPath, lockPath] = await setup([
    "./samples/Paradise-Lost-Victim-Of-The-Past.flac",
    "./samples/paradise-lost-victim-of-the-past.flac.lock",
  ]);
  const newPath = join(dir, "paradise-lost-victim-of-the-past.flac");
  await expect(tagtoname(oldPath)).rejects.toThrow(
    `EEXIST: file already exists, open '${lockPath}'`
  );
  expect(await access(oldPath)).toBe(undefined);
  await expect(access(newPath)).rejects.toThrow();
  await teardown(dir);
});

test("tagtoname with a path that does not exist", async () => {
  const [dir] = await setup([]);
  const oldPath = join(dir, "null");
  await expect(tagtoname(oldPath)).rejects.toThrow(
    `ENOENT: no such file or directory, stat '${oldPath}'`
  );
  await teardown(dir);
});

test("tagtoname with a file without metadata", async () => {
  const [dir, oldPath] = await setup(["./samples/empty"]);
  await expect(tagtoname(oldPath)).rejects.toThrow(
    "Failed to determine audio format"
  );
  expect(await access(oldPath)).toBe(undefined);
  await teardown(dir);
});
