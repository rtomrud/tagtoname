const test = require("../node_modules/tape/index.js");
const dest = require("../dest.js");

test("dest with missing arguments", ({ throws, end }) => {
  throws(() => dest(), TypeError, "throws TypeError given no first argument");
  throws(
    () => dest("folder/filename.mp3"),
    TypeError,
    "throws TypeError given no second argument"
  );
  throws(
    () => dest("folder/filename.mp3", "{}"),
    TypeError,
    "throws TypeError given no third argument"
  );
  end();
});

test("dest with missing tags", ({ equal, end }) => {
  equal(
    dest("folder/filename.mp3", "{}", ["title"]),
    "folder/.mp3",
    "returns a path whose basename is the ext given ffprobe output with no tags"
  );
  equal(
    dest(
      "folder/filename.mp3",
      { format: { tags: { title: "Yesterday" } } },
      []
    ),
    "folder/.mp3",
    "returns a path whose basename only has ext given no tags"
  );
  end();
});

test("dest with tags in the container", ({ equal, end }) => {
  equal(
    dest("folder/filename.mp3", { format: { tags: { title: "Yesterday" } } }, [
      "title"
    ]),
    "folder/yesterday.mp3",
    "returns a path with the given tags from the container"
  );
  end();
});

test("dest with tags in a stream", ({ equal, end }) => {
  equal(
    dest(
      "folder/filename.mp3",
      { streams: [{ tags: { title: "Yesterday" } }] },
      ["title"]
    ),
    "folder/yesterday.mp3",
    "returns the path with the given tags from the streams"
  );
  end();
});

test("dest with the same tag in the container and in a stream", ({
  equal,
  end
}) => {
  equal(
    dest(
      "folder/filename.mp3",
      {
        format: { tags: { title: "Yesterday" } },
        streams: [
          { tags: { title: "Yesterday (Audio Left)" } },
          { tags: { title: "Yesterday (Audio Right)" } }
        ]
      },
      ["title"]
    ),
    "folder/yesterday.mp3",
    "returns a path with the given tags from the container"
  );
  end();
});

test("dest with the keepCase option", ({ equal, end }) => {
  equal(
    dest(
      "folder/filename.mp3",
      { format: { tags: { artist: "The Beatles", title: "Yesterday" } } },
      ["artist", "title"],
      true
    ),
    "folder/The-Beatles-Yesterday.mp3",
    "returns a path with the given tags split with the given separator"
  );
  end();
});

test("dest with the separator option", ({ equal, end }) => {
  equal(
    dest(
      "folder/filename.mp3",
      { format: { tags: { artist: "The Beatles", title: "Yesterday" } } },
      ["artist", "title"],
      undefined,
      "---"
    ),
    "folder/the-beatles---yesterday.mp3",
    "returns a path with the given tags split with the given separator"
  );
  end();
});

test("dest with the keepCase and the separator options", ({ equal, end }) => {
  equal(
    dest(
      "folder/filename.mp3",
      { format: { tags: { artist: "The Beatles", title: "Yesterday" } } },
      ["artist", "title"],
      true,
      "---"
    ),
    "folder/The-Beatles---Yesterday.mp3",
    "returns a path with the given tags split with the given separator"
  );
  end();
});

test("dest with tags with invalid characters in a URL path", ({
  equal,
  end
}) => {
  equal(
    dest("folder/filename.mp3", { format: { tags: { title: "100%" } } }, [
      "title"
    ]),
    "folder/100.mp3",
    "returns a path without characters invalid in a URL path"
  );
  equal(
    dest("folder/filename.mp3", { format: { tags: { artist: "Аркона" } } }, [
      "artist"
    ]),
    "folder/arkona.mp3",
    "returns a path without non-ASCII characters, by transliterating to ASCII"
  );
  end();
});
