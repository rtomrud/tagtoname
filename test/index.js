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
const test = require("tape");
const tagtoname = require("../index.js");

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
  readdir(dir, { withFileTypes: true })
    .then((files) =>
      Promise.all(
        files.map((file) =>
          (file.isDirectory() ? teardown : unlink)(join(dir, file.name))
        )
      )
    )
    .then(() => rmdir(dir));

test("tagtoname without a path", async ({ equal, end }) => {
  equal(
    await tagtoname().catch(({ message }) => message),
    "ENOENT: no such file or directory, stat ''",
    "rejects with an error"
  );
  end();
});

test("tagtoname without options", async ({ equal, end }) => {
  const [dir, oldPath] = await setup([
    "./samples/Paradise-Lost-Victim-Of-The-Past.flac",
  ]);
  const newPath = join(dir, "paradise-lost-victim-of-the-past.flac");
  equal(await tagtoname(oldPath), newPath, "resolves with the new path");
  equal(await exists(oldPath), false, "deletes the old path");
  equal(await exists(newPath), true, "creates the new path");
  await teardown(dir);
  end();
});

test("tagtoname without options and with a file that already exists", async ({
  equal,
  end,
}) => {
  const [dir, oldPath] = await setup([
    "./samples/paradise-lost-victim-of-the-past.flac",
  ]);
  equal(await tagtoname(oldPath), oldPath, "resolves with the old path");
  equal(await exists(oldPath), true, "does not delete the old path");
  await teardown(dir);
  end();
});

test("tagtoname with the keepCase option", async ({ equal, end }) => {
  const [dir, oldPath] = await setup([
    "./samples/paradise-lost-victim-of-the-past.flac",
  ]);
  const newPath = join(dir, "Paradise-Lost-Victim-Of-The-Past.flac");
  equal(
    await tagtoname(oldPath, { keepCase: true }),
    newPath,
    "resolves with the new path"
  );
  equal(await exists(oldPath), false, "deletes the old path");
  equal(await exists(newPath), true, "creates the new path");
  await teardown(dir);
  end();
});

test("tagtoname with the noop option", async ({ equal, end }) => {
  const [dir, oldPath] = await setup([
    "./samples/Paradise-Lost-Victim-Of-The-Past.flac",
  ]);
  const newPath = join(dir, "paradise-lost-victim-of-the-past.flac");
  equal(
    await tagtoname(oldPath, { noop: true }),
    newPath,
    "resolves with the new path"
  );
  equal(await exists(oldPath), true, "does not delete the old path");
  equal(await exists(newPath), false, "does not create the new path");
  await teardown(dir);
  end();
});

test("tagtoname with the separator option", async ({ equal, end }) => {
  const [dir, oldPath] = await setup([
    "./samples/Paradise-Lost-Victim-Of-The-Past.flac",
  ]);
  const newPath = join(dir, "paradise-lost/victim-of-the-past.flac");
  equal(
    await tagtoname(oldPath, { separator: "/" }),
    newPath,
    "resolves with the new path"
  );
  equal(await exists(oldPath), false, "deletes the old path");
  equal(await exists(newPath), true, "creates the new path");
  await teardown(dir);
  end();
});

test("tagtoname with the tags option", async ({ equal, end }) => {
  const [dir, oldPath] = await setup(["./samples/9-Addicted-Numbered.ogg"]);
  const newPath = join(dir, "addicted-9-numbered.ogg");
  equal(
    await tagtoname(oldPath, { tags: ["album", "track", "title"] }),
    newPath,
    "resolves with the new path"
  );
  equal(await exists(oldPath), false, "deletes the old path");
  equal(await exists(newPath), true, "creates the new path");
  await teardown(dir);
  end();
});

test("tagtoname with the tags option and a missing tag", async ({
  equal,
  end,
}) => {
  const [dir, oldPath] = await setup(["./samples/9-Addicted-Numbered.ogg"]);
  const newPath = join(dir, "addicted-numbered.ogg");
  equal(
    await tagtoname(oldPath, { tags: ["genre", "album", "title"] }),
    newPath,
    "resolves with the new path"
  );
  equal(await exists(oldPath), false, "deletes the old path");
  equal(await exists(newPath), true, "creates the new path");
  await teardown(dir);
  end();
});

test("tagtoname with the tags option but all tags missing", async ({
  equal,
  end,
}) => {
  const [dir, oldPath] = await setup([
    "./samples/paradise-lost-victim-of-the-past.flac",
  ]);
  const newPath = join(dir, ".flac");
  equal(
    await tagtoname(oldPath, { tags: ["album", "track"] }).catch(
      ({ message }) => message
    ),
    `Failed because '${oldPath}' is missing all tags`,
    "rejects with an error"
  );
  equal(await exists(oldPath), true, "does not delete the old path");
  equal(await exists(newPath), false, "does not create the new path");
  await teardown(dir);
  end();
});

test("tagtoname with a file that would override another file", async ({
  equal,
  end,
}) => {
  const [dir, oldPath, newPath] = await setup([
    "./samples/Paradise-Lost-Victim-Of-The-Past.flac",
    "./samples/paradise-lost-victim-of-the-past.flac",
  ]);
  equal(
    await tagtoname(oldPath).catch(({ message }) => message),
    `Failed because '${newPath}' already exists`,
    "rejects with an error"
  );
  equal(await exists(oldPath), true, "does not delete the old path");
  await teardown(dir);
  end();
});

test("tagtoname with a locked file", async ({ equal, end }) => {
  const [dir, oldPath, lockPath] = await setup([
    "./samples/Paradise-Lost-Victim-Of-The-Past.flac",
    "./samples/paradise-lost-victim-of-the-past.flac.lock",
  ]);
  const newPath = join(dir, "paradise-lost-victim-of-the-past.flac");
  equal(
    await tagtoname(oldPath).catch(({ message }) => message),
    `EEXIST: file already exists, open '${lockPath}'`,
    "rejects with an error"
  );
  equal(await exists(oldPath), true, "does not delete the old path");
  equal(await exists(newPath), false, "does not create the new path");
  await teardown(dir);
  end();
});

test("tagtoname with a path that does not exist", async ({ equal, end }) => {
  const [dir] = await setup([]);
  const oldPath = join(dir, "null");
  equal(
    await tagtoname(oldPath).catch(({ message }) => message),
    `ENOENT: no such file or directory, stat '${oldPath}'`,
    "rejects with an error"
  );
  await teardown(dir);
  end();
});

test("tagtoname with a file without metadata", async ({ equal, end }) => {
  const [dir, oldPath] = await setup(["./samples/empty"]);
  equal(
    await tagtoname(oldPath).catch(({ message }) => message),
    "Failed to determine audio format",
    "rejects with an error"
  );
  equal(await exists(oldPath), true, "does not delete the old path");
  await teardown(dir);
  end();
});
