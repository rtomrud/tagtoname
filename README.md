# tagtoname

[![npm version](https://img.shields.io/npm/v/tagtoname.svg?style=flat-square)](https://www.npmjs.com/package/tagtoname)
[![Build Status](https://travis-ci.com/rtomrud/tagtoname.svg?branch=master)](https://travis-ci.com/rtomrud/tagtoname)
[![Coverage Status](https://coveralls.io/repos/github/rtomrud/tagtoname/badge.svg?branch=master)](https://coveralls.io/github/rtomrud/tagtoname?branch=master)

Renames audio or video files using their metadata tags

- Renames to names [safe for URLs and filenames](https://github.com/rtomrud/standard-slugify) by default, by transliterating or deleting unsafe characters
- Allows configuring the tags, their case, and the separator characters of the new name
- Has a dry run option (noop), so you can see the results before modifying the file system
- Uses [ffprobe](https://ffmpeg.org/ffprobe.html), so it supports most formats and containers, and lets you specify the ffprobe binary and its flags

## Installing

Make sure you have [ffprobe](https://ffmpeg.org/download.html) installed (it comes with [FFmpeg](https://ffmpeg.org)), and run:

```bash
npm install tagtoname
```

## CLI

```bash
Usage: tagtoname [-k] [-m number] [-n] [-o option]... [-p path] [-s separator]
                 [-t tag]... path...

Renames the files at path(s) to a URL-safe name using the metadata tag(s).

Options:

  -k, --keep-case            Keep the case from the tags when renaming
  -m, --max=MAX              Run at most MAX ffprobe tasks concurrently;
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
and the TITLE tag "Ode to Joy" is renamed to "beethoven-ode-to-joy.mp3".
```

### Examples

```bash
# Rename a file.
# For example, if the file has the "artist" tag "Beethoven", and the "title" tag
# "Ode to Joy", by default it will be renamed to "beethoven-ode-to-joy.mp3".
tagtoname file.mp3
```

```bash
# Rename all files in a folder (recursively).
tagtoname folder

# Rename a file and keep the case from the tags instead of lowercasing.
# For example, if the file has the "artist" tag "Philip Glass", and the "title"
# tag "Opening", it will be renamed to "Philip-Glass-Opening.mp3".
tagtoname -k file.mp3

# Rename all files in a folder, running at most 16 ffprobe tasks concurrently.
tagtoname -m 16 folder

# Dry run, output what would happen if we were to rename all files in a folder.
tagtoname -n folder

# Rename a file using the tags from the video stream.
# Use the -o flag to set ffprobe options to read the tags from the video stream.
tagtoname -o-show_streams -o-select_streams -ov file.mp4

# Rename a file using a specific ffprobe binary.
# Use the -p flag to specify the path to the custom ffprobe binary.
tagtoname -p bin/ffprobe-4.1.1 file.mp3

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

- `keepCase`: Keep the case from the tags when renaming, defaults to `false`
- `max`: The maximum amount of concurrent ffprobe tasks to spawn, defaults to `32`
- `noop`: Whether to perform a dry run and not rename files, defaults to `false`
- `options`: An array of ffprobe options to pass to ffprobe, defaults to `["-show_streams", "-show_format"]`
- `path`: The path of the ffprobe binary used to read metadata, defaults to `"ffprobe"`
- `separator`: The separator used to split the tags in the name, defaults to `"-"`
- `tags`: An array of tags to use in the new name of the file, defaults to `["ARTIST", "artist", "TITLE", "title"]`
- `dest`: A custom function, which can be either sync or async, that returns the destination path of a rename (the new path), with signature `(oldPath, ffprobeJSON, tags, keepCase, separator) => newPath`, where `oldPath` is the old path (string) of the file, `ffprobeJSON` is the JSON object returned by ffprobe, the above options `tags`, `keepCase`, and `separator` are the rest of arguments, the returned `newPath` is the new path (string) of the file, and if it throws or rejects an `"error"` event is emitted with the thrown error or rejection value

Returns an [`EventEmmiter`](https://nodejs.org/api/events.html#events_class_eventemitter) object with the following events:

- `"rename"`, emitted when the new path is different from the old path, passing the new path (string) to the callback
- `"same"`, emitted when the new path is the same as the old path, passing the old path (string) to the callback
- `"error"`, emitted when a file cannot be renamed, passing the `Error` object to the callback
- `"done"`, emitted when all files have been processed

### Examples

```js
import tagtoname from "tagtoname";

// Rename the files at /path/to/folder/ using the "artist" and "title" tags
tagtoname(["/path/to/folder/"], { tags: ["artist", "title"] })
  .on("rename", newPath => console.error(newPath))
  .on("same", oldPath => console.log(`${oldPath} kept as is`))
  .on("error", error => console.error(error.message))
  .on("done", () => console.log("Done"));
```

The API has the same options as the CLI, except that the API has an additional option: `dest`.

The `dest` option is a hook that runs before the rename and returns the new path that will be the destination of the rename. You may also use it to do other work before the rename, such as creating directories or copying files.

Note that the `dest` function can be either sync or async, and if it throws or
rejects an `"error"` event with the error will be emitted.

Hooking into the renaming logic with the `dest` option:

```js
import { mkdir } from "fs";
import { promisify } from "util";
import { dirname, join } from "path";
import tagtoname from "tagtoname";

const mkdirPromise = promisify(mkdir);

// Rename each file as the "TITLE" tag and put it into a directory named as the
// "ARTIST" tag, replacing whitespace characters with a -
tagtoname(["/path/to/folder/"], {
  dest: (oldPath, { format: { tags: { ARTIST, TITLE } = {} } = {} }) => {
    const dir = join(dirname(oldPath), ARTIST.replace(/\s+/giu, "-"));
    const newPath = join(dir, `${TITLE.replace(/\s+/giu, "-")}.flac`);
    return mkdirPromise(dir).then(
      () => newPath,
      error => (error.code === "EEXIST" ? newPath : Promise.reject(error))
    );
  }
});
```

## License

[MIT License](./LICENSE)
