const { exec } = require("child_process");
const {
  access,
  mkdtemp,
  readdir,
  rmdir,
  stat,
  unlink,
  writeFile
} = require("fs").promises;
const { tmpdir } = require("os");
const { extname, join, resolve } = require("path");
const test = require("../node_modules/tape/index.js");
const tagtoname = require("../index.js");

const exists = path =>
  access(path)
    .then(() => true)
    .catch(() => false);

const tagtonamePromise = (paths, options) =>
  new Promise(resolve => {
    const rename = [];
    const same = [];
    const error = [];
    const renamer = tagtoname(paths, options);
    renamer.on("done", () =>
      resolve({ rename: rename.sort(), same: same.sort(), error: error.sort() })
    );
    renamer.on("rename", path => rename.push(path));
    renamer.on("same", path => same.push(path));
    renamer.on("error", path => error.push(path));
  });

const setup = files =>
  mkdtemp(join(tmpdir(), "test-")).then(dir =>
    Promise.all(
      Object.entries(files).map(
        ([path, { format: { tags = {} } = {}, streams = [] } = {}]) => {
          const newPath = join(dir, path);
          const inputs =
            streams.length === 0
              ? `-f lavfi -i anullsrc `
              : streams
                  .map(() => `-f lavfi -i anullsrc`)
                  .concat(streams.map((_, i) => `-map ${i}`))
                  .join(" ");
          const containerMetadata = Object.entries(tags)
            .map(([key, value]) => `-metadata ${key}="${value}"`)
            .join(" ");
          const streamMetadata = streams
            .map(({ tags }, i) =>
              Object.entries(tags)
                .map(([key, value]) => `-metadata:s:${i} ${key}="${value}"`)
                .join(" ")
            )
            .join(" ");
          const codec = {
            ".flac": "flac",
            ".opus": "libopus",
            ".ogg": "libvorbis",
            ".m4a": "aac",
            ".mp3": "libmp3lame"
          }[extname(path)];
          return new Promise((resolve, reject) =>
            exec(
              `ffmpeg ${inputs} -t 1 -c:a ${codec} ${containerMetadata} ${streamMetadata} ${newPath}`,
              error => (error ? reject(error) : resolve(newPath))
            )
          );
        }
      )
    ).then(paths => [dir, ...paths])
  );

const teardown = dir =>
  readdir(dir)
    .then(files =>
      Promise.all(
        files.map(file => {
          const path = join(dir, file);
          return stat(path).then(stats =>
            (stats.isDirectory() ? teardown : unlink)(path)
          );
        })
      )
    )
    .then(() => rmdir(dir));

test("tagtoname with no arguments", async ({ deepEqual, end }) => {
  deepEqual(
    await tagtonamePromise(),
    { same: [], rename: [], error: [] },
    "emits only a done event"
  );
  end();
});

test("tagtoname with a non-string path", async ({ equal, end }) => {
  const {
    error: [error]
  } = await tagtonamePromise([false]);
  equal(
    Object.prototype.isPrototypeOf.call(TypeError.prototype, error),
    true,
    "emits an error event of type TypeError"
  );
  end();
});

test("tagtoname with a file that should be renamed", async ({
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
    await tagtonamePromise([oldPath]),
    { rename: [newPath], same: [], error: [] },
    "emits a rename event with the new path"
  );
  equal(await exists(oldPath), false, "deletes the old path");
  equal(await exists(newPath), true, "create the new path");
  await teardown(dir);
  end();
});

test("tagtoname with a properly named file", async ({
  deepEqual,
  equal,
  end
}) => {
  const [dir, oldPath] = await setup({
    "paradise-lost-victim-of-the-past.flac": {
      format: { tags: { ARTIST: "Paradise Lost", TITLE: "Victim Of The Past" } }
    }
  });
  deepEqual(
    await tagtonamePromise([oldPath]),
    { rename: [], same: [oldPath], error: [] },
    "emits a same event with the new path"
  );
  equal(await exists(oldPath), true, "does not delete the old path");
  await teardown(dir);
  end();
});

test("tagtoname with a path to a folder with properly named files", async ({
  deepEqual,
  end
}) => {
  const [dir, ...oldPaths] = await setup({
    "carnivore-five-billion-dead.opus": {
      format: { tags: { ARTIST: "Carnivore", TITLE: "Five Billion Dead" } }
    },
    "killing-joke-on-all-hallows-eve.mp3": {
      format: { tags: { artist: "Killing Joke", title: "On All Hallow's Eve" } }
    },
    "mr-bungle-quote-unquote.ogg": {
      format: { tags: { ARTIST: "Mr. Bungle", TITLE: "Quote Unquote" } }
    },
    "strapping-young-lad-skeksis.m4a": {
      format: { tags: { artist: "Strapping Young Lad", title: "Skeksis" } }
    },
    "voivod-tornado.flac": {
      format: { tags: { ARTIST: "Voivod", TITLE: "Tornado" } }
    }
  });
  deepEqual(
    await tagtonamePromise([dir]),
    { rename: [], same: oldPaths, error: [] },
    "emits a same event for each properly named file"
  );
  await teardown(dir);
  end();
});

test("tagtoname with the keepCase option", async ({
  deepEqual,
  equal,
  end
}) => {
  const [dir, oldPath] = await setup({
    "file.flac": {
      format: { tags: { ARTIST: "Paradise Lost", TITLE: "Victim Of The Past" } }
    }
  });
  const newPath = resolve(dir, "Paradise-Lost-Victim-Of-The-Past.flac");
  deepEqual(
    await tagtonamePromise([oldPath], { keepCase: true }),
    { rename: [newPath], same: [], error: [] },
    "emits a rename event with the new path"
  );
  equal(await exists(oldPath), false, "deletes the old path");
  equal(await exists(newPath), true, "create the new path");
  await teardown(dir);
  end();
});

test("tagtoname with the max option", async ({ deepEqual, equal, end }) => {
  const [dir, oldPath] = await setup({
    "file.flac": {
      format: { tags: { ARTIST: "Paradise Lost", TITLE: "Victim Of The Past" } }
    }
  });
  const newPath = resolve(dir, "paradise-lost-victim-of-the-past.flac");
  deepEqual(
    await tagtonamePromise([oldPath], { max: 1 }),
    { rename: [newPath], same: [], error: [] },
    "emits a rename event with the new path"
  );
  equal(await exists(oldPath), false, "deletes the old path");
  equal(await exists(newPath), true, "create the new path");
  await teardown(dir);
  end();
});

test("tagtoname with the noop option", async ({ deepEqual, equal, end }) => {
  const [dir, oldPath] = await setup({
    "file.flac": {
      format: { tags: { ARTIST: "Paradise Lost", TITLE: "Victim Of The Past" } }
    }
  });
  const newPath = resolve(dir, "paradise-lost-victim-of-the-past.flac");
  deepEqual(
    await tagtonamePromise([oldPath], { noop: true }),
    { rename: [newPath], same: [], error: [] },
    "emits a rename event with the new path"
  );
  equal(await exists(oldPath), true, "does not delete the old path");
  equal(await exists(newPath), false, "does not create the new path");
  await teardown(dir);
  end();
});

test("tagtoname with the options option", async ({ deepEqual, equal, end }) => {
  const [dir, oldPath] = await setup({
    "file.ogg": {
      streams: [
        {
          tags: {
            ARTIST: "Orchestra of State Opera Plovdiv",
            TITLE: "Victim Of The Past (With Orchestra)"
          }
        },
        {
          tags: { ARTIST: "Paradise Lost", TITLE: "Victim Of The Past" }
        }
      ]
    }
  });
  const newPath = resolve(dir, "paradise-lost-victim-of-the-past.ogg");
  deepEqual(
    await tagtonamePromise([oldPath], {
      options: ["-show_streams", "-select_streams a:1"]
    }),
    { rename: [newPath], same: [], error: [] },
    "emits a rename event with the new path"
  );
  equal(await exists(oldPath), false, "deletes the old path");
  equal(await exists(newPath), true, "create the new path");
  await teardown(dir);
  end();
});

test("tagtoname with the path option", async ({ deepEqual, equal, end }) => {
  const [dir, oldPath] = await setup({
    "file.flac": {
      format: { tags: { ARTIST: "Paradise Lost", TITLE: "Victim Of The Past" } }
    }
  });
  const newPath = resolve(dir, "paradise-lost-victim-of-the-past.flac");
  deepEqual(
    await tagtonamePromise([oldPath], { path: "ffprobe" }),
    { rename: [newPath], same: [], error: [] },
    "emits a rename event with the new path"
  );
  equal(await exists(oldPath), false, "deletes the old path");
  equal(await exists(newPath), true, "create the new path");
  await teardown(dir);
  end();
});

test("tagtoname with the separator option", async ({
  deepEqual,
  equal,
  end
}) => {
  const [dir, oldPath] = await setup({
    "file.flac": {
      format: { tags: { ARTIST: "Paradise Lost", TITLE: "Victim Of The Past" } }
    }
  });
  const newPath = resolve(dir, "paradise-lost---victim-of-the-past.flac");
  deepEqual(
    await tagtonamePromise([oldPath], { separator: "---" }),
    { rename: [newPath], same: [], error: [] },
    "emits a rename event with the new path"
  );
  equal(await exists(oldPath), false, "deletes the old path");
  equal(await exists(newPath), true, "create the new path");
  await teardown(dir);
  end();
});

test("tagtoname with the tags option", async ({ deepEqual, equal, end }) => {
  const [dir, oldPath] = await setup({
    "file.flac": {
      format: { tags: { ARTIST: "Paradise Lost", TITLE: "Victim Of The Past" } }
    }
  });
  const newPath = resolve(dir, "victim-of-the-past-paradise-lost.flac");
  deepEqual(
    await tagtonamePromise([oldPath], { tags: ["TITLE", "ARTIST"] }),
    { rename: [newPath], same: [], error: [] },
    "emits a rename event with the new path"
  );
  equal(await exists(oldPath), false, "deletes the old path");
  equal(await exists(newPath), true, "create the new path");
  await teardown(dir);
  end();
});

test("tagtoname with a file that would override another file on rename", async ({
  deepEqual,
  equal,
  end
}) => {
  const [dir, oldPath, existingFile] = await setup({
    "file.mp3": {
      format: { tags: { ARTIST: "Paradise Lost", TITLE: "Victim Of The Past" } }
    },
    "paradise-lost-victim-of-the-past.mp3": {}
  });
  deepEqual(
    await tagtonamePromise([oldPath]),
    {
      rename: [],
      same: [],
      error: [Error(`${oldPath} would override ${existingFile}`)]
    },
    "emits an error event with the path that caused the error and its new path"
  );
  equal(await exists(oldPath), true, "does not delete the old path");
  await teardown(dir);
  end();
});

test("tagtoname with a file unreadable by ffprobe", async ({
  equal,
  deepEqual,
  end
}) => {
  const dir = await mkdtemp(join(tmpdir(), "test-"));
  const oldPath = join(dir, "metadata.json");
  await writeFile(
    oldPath,
    '{ "album": "Mariner", "artist": "Cult of Luna & Julie Christmas", "tracks": 5 }'
  );
  deepEqual(
    await tagtonamePromise([oldPath]),
    {
      rename: [],
      same: [],
      error: [Error(`${oldPath}: Invalid data found when processing input\n`)]
    },
    "emits an error event with the path that caused the error"
  );
  equal(await exists(oldPath), true, "does not delete the old path");
  await teardown(dir);
  end();
});
