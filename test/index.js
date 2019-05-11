const { exec } = require("child_process");
const {
  exists,
  mkdir,
  mkdtemp,
  readdir,
  rmdir,
  stat,
  unlink,
  writeFile
} = require("fs");
const { tmpdir } = require("os");
const { dirname, extname, join, resolve } = require("path");
const { promisify } = require("util");
const test = require("../node_modules/tape/index.js");
const tagtoname = require("../index.js");

const execPromise = promisify(exec);
const existsPromise = promisify(exists);
const mkdirPromise = promisify(mkdir);
const mkdtempPromise = promisify(mkdtemp);
const readdirPromise = promisify(readdir);
const rmdirPromise = promisify(rmdir);
const statPromise = promisify(stat);
const unlinkPromise = promisify(unlink);
const writeFilePromise = promisify(writeFile);

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

const encodersByExt = {
  ".flac": "flac",
  ".opus": "libopus",
  ".ogg": "libvorbis",
  ".m4a": "aac",
  ".mp3": "libmp3lame"
};

const setup = files =>
  mkdtempPromise(join(tmpdir(), "test-")).then(dir =>
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
          return execPromise(
            `ffmpeg ${inputs} -t 1 -c:a ${
              encodersByExt[extname(path)]
            } ${containerMetadata} ${streamMetadata} ${newPath}`
          ).then(() => newPath);
        }
      )
    ).then(paths => [dir, ...paths])
  );

const teardown = dir =>
  readdirPromise(dir)
    .then(files =>
      Promise.all(
        files.map(file => {
          const path = join(dir, file);
          return statPromise(path).then(stats =>
            (stats.isDirectory() ? teardown : unlinkPromise)(path)
          );
        })
      )
    )
    .then(() => rmdirPromise(dir));

test("tagtoname with no arguments", async ({ deepEqual, end }) => {
  deepEqual(
    await tagtonamePromise(),
    { same: [], rename: [], error: [] },
    "emits only a done event"
  );
  end();
});

test("tagtoname with a non-string path", async ({ deepEqual, end }) => {
  deepEqual(
    await tagtonamePromise([false]),
    {
      same: [],
      rename: [],
      error: [
        TypeError(
          '[ERR_INVALID_ARG_TYPE]: The "path" argument must be one of type string, Buffer, or URL. Received type boolean'
        )
      ]
    },
    "emits an error event with a TypeError"
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
  equal(await existsPromise(oldPath), false, "deletes the old path");
  equal(await existsPromise(newPath), true, "create the new path");

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
  equal(await existsPromise(oldPath), true, "does not delete the old path");

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
  equal(await existsPromise(oldPath), false, "deletes the old path");
  equal(await existsPromise(newPath), true, "create the new path");

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
  equal(await existsPromise(oldPath), false, "deletes the old path");
  equal(await existsPromise(newPath), true, "create the new path");

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
  equal(await existsPromise(oldPath), true, "does not delete the old path");
  equal(await existsPromise(newPath), false, "does not create the new path");

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
          tags: {
            ARTIST: "Paradise Lost",
            TITLE: "Victim Of The Past"
          }
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
  equal(await existsPromise(oldPath), false, "deletes the old path");
  equal(await existsPromise(newPath), true, "create the new path");

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
  equal(await existsPromise(oldPath), false, "deletes the old path");
  equal(await existsPromise(newPath), true, "create the new path");

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
  equal(await existsPromise(oldPath), false, "deletes the old path");
  equal(await existsPromise(newPath), true, "create the new path");

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
  equal(await existsPromise(oldPath), false, "deletes the old path");
  equal(await existsPromise(newPath), true, "create the new path");

  await teardown(dir);
  end();
});

test("tagtoname with the dest option", async ({ deepEqual, equal, end }) => {
  const [dir, oldPath] = await setup({
    "file.flac": {
      format: { tags: { ARTIST: "Paradise Lost", TITLE: "Victim Of The Past" } }
    }
  });
  const newPath = resolve(dir, "Paradise_Lost", "Victim_Of_The_Past.flac");

  deepEqual(
    await tagtonamePromise([oldPath], {
      dest: (oldPath, { format: { tags: { ARTIST, TITLE } = {} } = {} }) => {
        const dir = join(dirname(oldPath), ARTIST.replace(/\s+/giu, "_"));
        const newPath = join(dir, `${TITLE.replace(/\s+/giu, "_")}.flac`);
        return mkdirPromise(dir).then(
          () => newPath,
          error => (error.code === "EEXIST" ? newPath : Promise.reject(error))
        );
      }
    }),
    { rename: [newPath], same: [], error: [] },
    "emits a rename event with the new path"
  );
  equal(await existsPromise(oldPath), false, "deletes the old path");
  equal(await existsPromise(newPath), true, "create the new path");

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
  equal(await existsPromise(oldPath), true, "does not delete the old path");

  await teardown(dir);
  end();
});

test("tagtoname with a file unreadable by ffprobe", async ({
  equal,
  deepEqual,
  end
}) => {
  const dir = await mkdtempPromise(join(tmpdir(), "test-"));
  const oldPath = join(dir, "metadata.json");
  await writeFilePromise(
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
  equal(await existsPromise(oldPath), true, "does not delete the old path");

  await teardown(dir);
  end();
});
