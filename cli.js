#!/usr/bin/env node

import console from "node:console";
import process from "node:process";
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import getopts from "getopts";
import { globIterate } from "glob";
import tagtoname from "./index.js";

const opts = getopts(process.argv.slice(2), {
  alias: {
    i: "ignore",
    k: ["keep-case", "keepCase"],
    n: "noop",
    s: "separator",
    t: "tag",
  },
  boolean: ["k", "n", "help", "version"],
  string: ["i", "s", "t"],
  default: { s: "-", t: ["artist", "title"] },
});

if (opts.help || (!opts.version && opts._.length === 0)) {
  const log = opts.help ? console.log : console.error;
  log(`Usage: tagtoname [-i] [-k] [-n] [-s separator] [-t tag]... file...

Renames audio files using the metadata tags.

Options:

  -i, --ignore=GLOB          Ignore a glob pattern
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
  const data = await readFile(new URL("./package.json", import.meta.url));
  const { version } = JSON.parse(data);
  console.log(`tagtoname ${version}`);
} else {
  const options = {
    keepCase: opts.k,
    noop: opts.n,
    separator: opts.s,
    tags: Array.isArray(opts.t) ? opts.t : [opts.t],
  };
  const iterator = globIterate(opts._, { ignore: opts.i });
  for await (const path of iterator) {
    try {
      const dest = await tagtoname(path, options);
      console.log(dest);
    } catch ({ message }) {
      process.exitCode = 1;
      console.error(`${path}: ${message}`);
    }
  }
}
