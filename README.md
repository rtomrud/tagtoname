# tagtoname

[![build status](https://github.com/rtomrud/tagtoname/workflows/build/badge.svg)](https://github.com/rtomrud/tagtoname/actions?query=branch%3Amaster+workflow%3Abuild)
[![npm version](https://badgen.net/npm/v/tagtoname)](https://www.npmjs.com/package/tagtoname)

Renames audio files using the metadata tags

## Installing

```bash
npm install tagtoname
```

## CLI

```
Usage: tagtoname [-k] [-n] [-s separator] [-t tag]... file...

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
and the title tag "Ode to Joy" is renamed to "beethoven-ode-to-joy.mp3".
```

See [the list of supported tags](https://github.com/Borewit/music-metadata/blob/v7.11.3/doc/common_metadata.md) (the `-t` option accepts any value from the "Common tag" column).

### Examples

```bash
# Rename a file.
# For example, if the file has the "artist" tag "Beethoven", and the "title" tag
# "Ode to Joy", by default it will be renamed to "beethoven-ode-to-joy.mp3".
tagtoname file.mp3

# Rename all files in a folder.
tagtoname folder/*
```

```bash
# Rename a file and keep the original case of the tags instead of lowercasing.
# For example, if the file has the "artist" tag "Philip Glass", and the "title"
# tag "Opening", it will be renamed to "Philip-Glass-Opening.mp3".
tagtoname -k file.mp3

# Dry run, output what would happen if we were to rename all files in a folder.
tagtoname -n folder/*

# Rename a file using a custom separator.
# For example, if the file has the "artist" tag "Debussy" and the "title" tag
# "Reverie", the file will be renamed to "debussy/reverie.mp3" (since the
# separator is "/", the folder "debussy" is created if needed).
tagtoname -s / file.mp3

# Rename a file using specific tags.
# For example, if the file has the "title" tag "A Clockwork Orange", and the
# "year" tag "1971", it will be renamed to "a-clockwork-orange-1971.mp4".
tagtoname -t title -t year file.mp4
```

## API

### `tagtoname(paths, options)`

Renames an audio file using its metadata tags. Resolves with the new path.

The first argument is the `path` of the file to be renamed.

The second argument is an options object with the following properties:

- `keepCase`: Keep the original case of the tags when renaming, defaults to `false`
- `noop`: Perform a dry run without renaming the file, defaults to `false`
- `separator`: The separator used to split the tags in the new name, defaults to `"-"`
- `tags`: An array of the tags used in the new name, defaults to `["artist", "title"]`

### Examples

```js
import tagtoname from "tagtoname";

// Rename "/file.mp3"
// assuming the artist tag is "Queen" and the title tag is "Bohemian Rhapsody"
tagtoname("/file.mp3").then(console.log);
// => /queen-bohemian-rhapsody.mp3

// Rename "/file.mp3" keeping the original case
// assuming the artist tag is "Queen" and the title tag is "Bohemian Rhapsody"
tagtoname("/file.mp3", { keepCase: true }).then(console.log);
// => /Queen-Bohemian-Rhapsody.mp3

// Rename "/file.mp3" using "/" as a separator
// assuming the artist tag is "Queen" and the title tag is "Bohemian Rhapsody"
// (since the separator is "/", the folder "queen" is created if needed).
tagtoname("/file.mp3", { separator: "/" }).then(console.log);
// => /queen/bohemian-rhapsody.mp3

// Rename "/file.mp3" using the "year" and "title" tags
// assuming the year tag is "1975" and the title tag is "Bohemian Rhapsody"
tagtoname("/file.mp3", { tags: ["year", "title"] }).then(console.log);
// => /1975-bohemian-rhapsody.mp3
```

## License

[MIT](./LICENSE)
