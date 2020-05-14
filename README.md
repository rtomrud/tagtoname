# tagtoname

[![npm version](https://badgen.net/npm/v/tagtoname)](https://www.npmjs.com/package/tagtoname)
[![build status](https://github.com/rtomrud/tagtoname/workflows/build/badge.svg)](https://github.com/rtomrud/tagtoname/actions?query=branch%3Amaster+workflow%3Abuild)

Renames audio or video files using their metadata tags

- Renames to names [safe for URLs and filenames](https://github.com/rtomrud/standard-slugify) by default, by transliterating or deleting unsafe characters
- Allows configuring the tags, their case, and the separator characters of the new name
- Has a dry run option (noop), so you can see the results before modifying the file system
- Uses [ffprobe](https://ffmpeg.org/ffprobe.html), so it supports most formats and containers

## Installing

Make sure you have [ffprobe](https://ffmpeg.org/download.html) installed (it comes with [FFmpeg](https://ffmpeg.org)), and run:

```bash
npm install tagtoname
```

## CLI

```
Usage: tagtoname [-k] [-n] [-s separator] [-t tag]... path...

Renames the files at path(s) to a URL-safe name using the metadata tag(s).

Options:

  -k, --keep-case            Keep the original case of the tags when renaming
  -n, --noop                 Dry run, show new paths without renaming the files
  -s, --separator=SEPARATOR  Split tags with SEPARATOR;
                             defaults to -s-
  -t, --tag=TAG              Append TAG(s) to the new name;
                             defaults to -t ARTIST -t artist -t TITLE -t title
  --help                     Show help
  --version                  Output the version number

For example, by default a file with the "mp3" ext, the ARTIST tag "Beethoven",
and the TITLE tag "Ode to Joy" is renamed to "beethoven-ode-to-joy.mp3".
```

### Examples

```bash
# Rename a file.
# For example, if the file has the "artist" tag "Beethoven", and the "title" tag
# "Ode to Joy", by default it will be renamed to "beethoven-ode-to-joy.mp3".
tagtoname file.mp3

# Rename all files in a folder (recursively).
tagtoname folder
```

```bash
# Rename a file and keep the original case of the tags instead of lowercasing.
# For example, if the file has the "artist" tag "Philip Glass", and the "title"
# tag "Opening", it will be renamed to "Philip-Glass-Opening.mp3".
tagtoname -k file.mp3

# Dry run, output what would happen if we were to rename all files in a folder.
tagtoname -n folder

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

Renames the audio or video files using their metadata tags.

The given `paths` can be files or directories, in which case it recursively
traverses them.

The second argument is an options object with the following properties:

- `keepCase`: Keep the original case of the tags when renaming, defaults to `false`
- `noop`: Whether to perform a dry run and not rename files, defaults to `false`
- `separator`: The separator used to split the tags in the name, defaults to `"-"`
- `tags`: An array of tags to use in the new name of the file, defaults to `["ARTIST", "artist", "TITLE", "title"]`

Returns an [`EventEmmiter`](https://nodejs.org/api/events.html#events_class_eventemitter) object with the following events:

- `"success"`, emitted when the new path is different from the old path, passing the new path (string) to the callback
- `"abort"`, emitted when the new path is the same as the old path, passing the old path (string) to the callback
- `"error"`, emitted when a file cannot be renamed, passing the `Error` object to the callback
- `"complete"`, emitted when all files have been processed

### Examples

```js
import tagtoname from "tagtoname";

// Rename the files at /path/to/folder/ using the "artist" and "title" tags
tagtoname(["/path/to/folder/"], { tags: ["artist", "title"] })
  .on("success", newPath => console.log(newPath))
  .on("abort", oldPath => console.log(`${oldPath} (unchanged)`))
  .on("error", error => console.error(error.message));
```

## License

[MIT License](./LICENSE)
