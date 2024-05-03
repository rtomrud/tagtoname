/**
 * Options for renaming an audio file using its metadata tags.
 */
interface TagToNameOptions {
  /**
   * Keep the original case of the tags when renaming. Defaults to `false`.
   */
  keepCase?: boolean;

  /**
   * Perform a dry run without renaming the file. Defaults to `false`.
   */
  noop?: boolean;

  /**
   * The separator used to split the tags in the new name. Defaults to `"-"`.
   */
  separator?: string;

  /**
   * An array of the tags used in the new name. Defaults to `["artist", "title"]`.
   */
  tags?: string[];
}

/**
 * Renames an audio file using its metadata tags. Resolves with the new path.
 *
 * @param path The path of the file to be renamed.
 * @param options An options object.
 * @returns A Promise resolving with the new path.
 */
export default function tagToName(
  path?: string,
  options?: TagToNameOptions,
): Promise<string>;
