#!/usr/bin/env node

const { cpus } = require("os");
const getopts = require("getopts");
const tagtoname = require("../index.js");

const opts = getopts(process.argv.slice(2), {
  alias: { k: ["keep-case", "keepCase"], n: "noop", s: "separator", t: "tag" },
  boolean: ["k", "n", "help", "version"],
  string: ["s", "t"],
  default: { s: "-", t: ["artist", "title"] },
});

if (opts.help || (!opts.version && opts._.length === 0)) {
  const log = opts.help ? console.log : console.error;
  log(`Usage: tagtoname [-k] [-n] [-s separator] [-t tag]... file...

Renames audio files using the metadata tags.

Options:

  -k, --keep-case            Keep the original case of the tags when renaming
  -n, --noop                 Dry run, show new paths without renaming the files
  -s, --separator=SEPARATOR  Split tags with SEPARATOR;
                             defaults to -s-
  -t, --tag=TAG              Append TAG(s) to the new name;
                             defaults to -t artist -t title
  --help                     Show help
  --version                  Output the version number

For example, by default a file with the "mp3" ext, the artist tag "Beethoven",
and the title tag "Ode to Joy" is renamed to "beethoven-ode-to-joy.mp3".`);
  process.exit(opts.help ? 0 : 1);
} else if (opts.version) {
  const { version } = require("../package.json");
  console.log(`tagtoname ${version}`);
} else {
  const paths = opts._;
  const options = {
    keepCase: opts.k,
    noop: opts.n,
    separator: opts.s,
    tags: Array.isArray(opts.t) ? opts.t : [opts.t],
  };
  let jobs = paths.length;
  const work = async (path) => {
    try {
      const dest = await tagtoname(path, options);
      console.log(dest);
    } catch ({ message }) {
      process.exitCode = 1;
      console.error(`${path}: ${message}`);
    }

    if (jobs === 0) {
      return null;
    }

    jobs -= 1;
    return work(paths[jobs]);
  };

  const cpuCount = cpus().length;
  for (let workers = 0; jobs > 0 && workers < cpuCount; workers += 1) {
    jobs -= 1;
    work(paths[jobs]);
  }
}
