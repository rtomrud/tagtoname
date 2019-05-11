const { dirname, extname, join } = require("path");
const standardSlugify = require("standard-slugify");

module.exports = function(
  oldPath,
  { format: { tags: formatTags = {} } = {}, streams = [] },
  tags,
  keepCase = false,
  separator = "-"
) {
  const metadataTags = Object.assign(
    streams.reduce(
      (streamTags, { tags }) => Object.assign(streamTags, tags),
      {}
    ),
    formatTags
  );
  const name = tags
    .map(tag => metadataTags[tag])
    .filter(element => element != null)
    .join(separator);
  return join(
    dirname(oldPath),
    `${standardSlugify(name, { keepCase })}${extname(oldPath)}`
  );
};
