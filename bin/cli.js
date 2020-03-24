#!/usr/bin/env node

const getopts = require("getopts");
const tagtoname = require("../index.js");

const opts = getopts(process.argv.slice(2), {
  alias: {
    k: ["keep-case", "keepCase"],
    m: "max",
    n: "noop",
    o: "option",
    p: "path",
    s: "separator",
    t: "tag"
  },
  boolean: ["k", "n", "help", "version"],
  string: ["m", "o", "p", "s", "t"],
  default: {
    m: 32,
    o: ["-show_streams", "-show_format"],
    p: "ffprobe",
    s: "-",
    t: ["ARTIST", "artist", "TITLE", "title"]
  }
});

if (opts.help || (!opts.version && opts._.length === 0)) {
  const log = opts.help ? console.log : console.error;
  log(`Usage: tagtoname [-k] [-m number] [-n] [-o option]... [-p path] [-s separator]
                 [-t tag]... path...

Renames the files at path(s) to a URL-safe name using the metadata tag(s).

Options:

  -k, --keep-case            Keep the case from the tags when renaming
  -m, --max=NUMBER           Run at most MAX ffprobe tasks concurrently;
                             defaults to -m 32
  -n, --noop                 Dry run, show new paths without renaming the files
  -o, --option=OPTION        Read metadata with ffprobe OPTION(s);
                             defaults to -o-show_format -o-show_streams
  -p, --path=PATH            Read metadata with the ffprobe binary at PATH;
                             defaults to -p ffprobe
  -s, --separator=SEPARATOR  Split tags with SEPARATOR;
                             defaults to -s-
  -t, --tag=TAG              Append TAG(s) to the new name;
                             defaults to -t ARTIST -t artist -t TITLE -t title
  --help                     Show help
  --version                  Output the version number

For example, by default a file with the "mp3" ext, the ARTIST tag "Beethoven",
and the TITLE tag "Ode to Joy" is renamed to "beethoven-ode-to-joy.mp3".`);
  process.exit(opts.help ? 0 : 1);
} else if (opts.version) {
  const { version } = require("../package.json");
  console.log(`tagtoname ${version}`);
} else {
  const renamer = tagtoname(
    opts._,
    Object.assign(opts, {
      options: Array.isArray(opts.option) ? opts.option : [opts.option],
      tags: Array.isArray(opts.tag) ? opts.tag : [opts.tag]
    })
  );
  renamer.on("same", console.log);
  renamer.on("rename", console.log);
  renamer.on("error", ({ message }) => {
    console.error(message);
    process.exitCode = 1;
  });
}
