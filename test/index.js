const {
  access,
  copyFile,
  mkdtemp,
  readdir,
  rmdir,
  unlink,
} = require("fs").promises;
const { tmpdir } = require("os");
const { basename, join, resolve } = require("path");
const test = require("../node_modules/tape/index.js");
const tagtoname = require("../index.js");

const exists = (path) =>
  access(path)
    .then(() => true)
    .catch(() => false);

const tagtonamePromise = (paths, options) =>
  new Promise((resolve) => {
    const success = [];
    const abort = [];
    const error = [];
    const renamer = tagtoname(paths, options);
    renamer.on("complete", () =>
      resolve({
        success: success.sort(),
        abort: abort.sort(),
        error: error.sort(),
      })
    );
    renamer.on("success", (path) => success.push(path));
    renamer.on("abort", (path) => abort.push(path));
    renamer.on("error", (path) => error.push(path));
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

test("tagtoname with no arguments", async ({ deepEqual, end }) => {
  deepEqual(
    await tagtonamePromise(),
    { success: [], abort: [], error: [] },
    "emits only a done event"
  );
  end();
});

test("tagtoname with a file", async ({ deepEqual, equal, end }) => {
  const [dir, oldPath] = await setup([
    "./samples/Paradise-Lost-Victim-Of-The-Past.flac",
  ]);
  const newPath = resolve(dir, "paradise-lost-victim-of-the-past.flac");
  deepEqual(
    await tagtonamePromise([oldPath]),
    { success: [newPath], abort: [], error: [] },
    "emits a success event with the new path"
  );
  equal(await exists(oldPath), false, "deletes the old path");
  equal(await exists(newPath), true, "creates the new path");
  await teardown(dir);
  end();
});

test("tagtoname with a file that should not be renamed", async ({
  deepEqual,
  equal,
  end,
}) => {
  const [dir, oldPath] = await setup([
    "./samples/paradise-lost-victim-of-the-past.flac",
  ]);
  deepEqual(
    await tagtonamePromise([oldPath]),
    { success: [], abort: [oldPath], error: [] },
    "emits an abort event with the new path"
  );
  equal(await exists(oldPath), true, "does not delete the old path");
  await teardown(dir);
  end();
});

test("tagtoname with files that should not be renamed", async ({
  deepEqual,
  end,
}) => {
  const [dir, ...oldPaths] = await setup([
    "./samples/carnivore-five-billion-dead.opus",
    "./samples/killing-joke-on-all-hallows-eve.mp3",
    "./samples/mr-bungle-quote-unquote.ogg",
    "./samples/strapping-young-lad-skeksis.m4a",
    "./samples/voivod-tornado.flac",
  ]);
  deepEqual(
    await tagtonamePromise(oldPaths),
    { success: [], abort: oldPaths, error: [] },
    "emits an abort event for each properly named file"
  );
  await teardown(dir);
  end();
});

test("tagtoname with the keepCase option", async ({
  deepEqual,
  equal,
  end,
}) => {
  const [dir, oldPath] = await setup([
    "./samples/paradise-lost-victim-of-the-past.flac",
  ]);
  const newPath = resolve(dir, "Paradise-Lost-Victim-Of-The-Past.flac");
  deepEqual(
    await tagtonamePromise([oldPath], { keepCase: true }),
    { success: [newPath], abort: [], error: [] },
    "emits a success event with the new path"
  );
  equal(await exists(oldPath), false, "deletes the old path");
  equal(await exists(newPath), true, "creates the new path");
  await teardown(dir);
  end();
});

test("tagtoname with the noop option", async ({ deepEqual, equal, end }) => {
  const [dir, oldPath] = await setup([
    "./samples/Paradise-Lost-Victim-Of-The-Past.flac",
  ]);
  const newPath = resolve(dir, "paradise-lost-victim-of-the-past.flac");
  deepEqual(
    await tagtonamePromise([oldPath], { noop: true }),
    { success: [newPath], abort: [], error: [] },
    "emits a success event with the new path"
  );
  equal(await exists(oldPath), true, "does not delete the old path");
  equal(await exists(newPath), false, "does not create the new path");
  await teardown(dir);
  end();
});

test("tagtoname with the separator option", async ({
  deepEqual,
  equal,
  end,
}) => {
  const [dir, oldPath] = await setup([
    "./samples/Paradise-Lost-Victim-Of-The-Past.flac",
  ]);
  const newPath = resolve(dir, "paradise-lost---victim-of-the-past.flac");
  deepEqual(
    await tagtonamePromise([oldPath], { separator: "---" }),
    { success: [newPath], abort: [], error: [] },
    "emits a success event with the new path"
  );
  equal(await exists(oldPath), false, "deletes the old path");
  equal(await exists(newPath), true, "creates the new path");
  await teardown(dir);
  end();
});

test("tagtoname with the tags option", async ({ deepEqual, equal, end }) => {
  const [dir, oldPath] = await setup(["./samples/9-Addicted-Numbered.ogg"]);
  const newPath = resolve(dir, "addicted-9-numbered.ogg");
  deepEqual(
    await tagtonamePromise([oldPath], { tags: ["album", "track", "title"] }),
    { success: [newPath], abort: [], error: [] },
    "emits a success event with the new path"
  );
  equal(await exists(oldPath), false, "deletes the old path");
  equal(await exists(newPath), true, "creates the new path");
  await teardown(dir);
  end();
});

test("tagtoname with a file that would override another file", async ({
  deepEqual,
  equal,
  end,
}) => {
  const [dir, oldPath, existingFile] = await setup([
    "./samples/Paradise-Lost-Victim-Of-The-Past.flac",
    "./samples/paradise-lost-victim-of-the-past.flac",
  ]);
  deepEqual(
    await tagtonamePromise([oldPath]),
    {
      success: [],
      abort: [],
      error: [Error(`${oldPath}: would override ${existingFile}`)],
    },
    "emits an error event with the path that caused the error and its new path"
  );
  equal(await exists(oldPath), true, "does not delete the old path");
  await teardown(dir);
  end();
});

test("tagtoname with a file without metadata", async ({
  equal,
  deepEqual,
  end,
}) => {
  const [dir, oldPath] = await setup(["./samples/empty"]);
  deepEqual(
    await tagtonamePromise([oldPath]),
    {
      success: [],
      abort: [],
      error: [Error(`${oldPath}: could not read metadata`)],
    },
    "emits an error event with the path that caused the error"
  );
  equal(await exists(oldPath), true, "does not delete the old path");
  await teardown(dir);
  end();
});

test("tagtoname with a missing path", async ({ deepEqual, end }) => {
  const [dir] = await setup([]);
  const path = join(dir, "null");
  deepEqual(
    await tagtonamePromise([path]),
    {
      success: [],
      abort: [],
      error: [Error(`${path}: could not read metadata`)],
    },
    "emits an error event of type TypeError"
  );
  await teardown(dir);
  end();
});
