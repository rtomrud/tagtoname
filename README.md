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

See [the list of supported tags](https://github.com/Borewit/music-metadata/blob/v6.4.0/doc/common_metadata.md#common-metadata) (the `-t` option accepts any value from the "Common tag" column).

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
# For example, if the file has the "artist" tag "Debussy", and the "title" tag
# "Reverie", it will be renamed to "debussy_reverie.mp3".
tagtoname -s _ file.mp3

# Rename a file using specific tags.
# For example, if the file has the "title" tag "A Clockwork Orange", and the
# "year" tag "1971", it will be renamed to "a-clockwork-orange-1971.mp4".
tagtoname -t title -t year file.mp4
```

## API

### `tagtoname(paths, options)`

Renames audio files using the metadata tags.

The first argument is an array of `paths` to the files to be renamed.

The second argument is an options object with the following properties:

- `keepCase`: Keep the original case of the tags when renaming, defaults to `false`
- `noop`: Whether to perform a dry run and not rename files, defaults to `false`
- `separator`: The separator used to split the tags in the name, defaults to `"-"`
- `tags`: An array of tags to use in the new name of the file, defaults to `["artist", "title"]`

Returns an [`EventEmmiter`](https://nodejs.org/api/events.html#events_class_eventemitter) object with the following events:

- `"success"`, emitted when the new path is different from the old path, passing the new path (string) to the callback
- `"abort"`, emitted when the new path is the same as the old path, passing the old path (string) to the callback
- `"error"`, emitted when a file cannot be renamed, passing the `Error` object to the callback
- `"complete"`, emitted when all files have been processed

### Examples

```js
import tagtoname from "tagtoname";

// Rename files using the "title" and "year" tags
tagtoname(["file1.mp4", "file2.mp4"], { tags: ["title", "year"] })
  .on("success", newPath => console.log(newPath))
  .on("abort", oldPath => console.log(`${oldPath} (unchanged)`))
  .on("error", error => console.error(error.message));
```

## License

[MIT](./LICENSE)
