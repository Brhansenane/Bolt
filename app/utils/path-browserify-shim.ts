/**
 * This is a minimal shim for the Node.js path module
 * It provides just enough functionality for isomorphic-git to work in the browser
 */

export const join = (...parts: string[]): string => {
  return parts
    .map((part, i) => {
      if (i === 0) {
        return part.trim().replace(/[\/]*$/g, '');
      } else {
        return part.trim().replace(/(^[\/]*|[\/]*$)/g, '');
      }
    })
    .filter((x) => x.length)
    .join('/');
};

export const resolve = (...parts: string[]): string => {
  let resolvedPath = '';
  let resolvedAbsolute = false;

  for (let i = parts.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    const path = i >= 0 ? parts[i] : '/';

    // Skip empty entries
    if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // Normalize the path
  resolvedPath = resolvedPath.replace(/\/\/+/g, '/');

  return (resolvedAbsolute ? '/' : '') + resolvedPath;
};

export const dirname = (path: string): string => {
  if (!path) {
    return '.';
  }

  // Strip trailing slashes
  path = path.replace(/\/+$/, '');

  // Get dirname
  const lastSlash = path.lastIndexOf('/');

  if (lastSlash === -1) {
    return '.';
  }

  if (lastSlash === 0) {
    return '/';
  }

  return path.slice(0, lastSlash);
};

export const basename = (path: string, ext?: string): string => {
  if (!path) {
    return '';
  }

  // Get basename
  const lastSlash = path.lastIndexOf('/');
  path = lastSlash === -1 ? path : path.slice(lastSlash + 1);

  // Remove extension if specified
  if (ext && path.endsWith(ext)) {
    path = path.slice(0, -ext.length);
  }

  return path;
};

export const extname = (path: string): string => {
  if (!path) {
    return '';
  }

  const lastDot = path.lastIndexOf('.');
  const lastSlash = path.lastIndexOf('/');

  // If there's no dot, or the last dot is before the last slash, there's no extension
  if (lastDot === -1 || (lastSlash !== -1 && lastDot < lastSlash)) {
    return '';
  }

  return path.slice(lastDot);
};

export const sep = '/';
export const delimiter = ':';

export const isAbsolute = (path: string): boolean => {
  return path.startsWith('/');
};

export const normalize = (path: string): string => {
  if (!path) {
    return '.';
  }

  // Replace backslashes with forward slashes
  path = path.replace(/\\/g, '/');

  // Remove duplicate slashes
  path = path.replace(/\/\/+/g, '/');

  return path;
};

// Add the missing functions

export interface ParsedPath {
  root: string;
  dir: string;
  base: string;
  ext: string;
  name: string;
}

export const parse = (pathString: string): ParsedPath => {
  const parsed: ParsedPath = {
    root: '',
    dir: '',
    base: '',
    ext: '',
    name: '',
  };

  if (!pathString) {
    return parsed;
  }

  // Get the root
  if (pathString.startsWith('/')) {
    parsed.root = '/';
  }

  // Get the extension and base
  parsed.ext = extname(pathString);
  parsed.base = basename(pathString);

  // Get the name (base without extension)
  parsed.name = parsed.ext ? parsed.base.slice(0, -parsed.ext.length) : parsed.base;

  // Get the directory
  parsed.dir = dirname(pathString);

  return parsed;
};

export const format = (pathObject: Partial<ParsedPath>): string => {
  if (!pathObject) {
    return '';
  }

  // If dir and root are specified, only use dir
  const dir = pathObject.dir || pathObject.root || '';

  // If base is specified, use it
  let base = pathObject.base || '';

  // If no base is specified but name and ext are, use them
  if (!base && pathObject.name) {
    base = pathObject.name;

    if (pathObject.ext) {
      base += pathObject.ext;
    }
  }

  // Join dir and base
  if (!dir) {
    return base;
  }

  if (!base) {
    return dir;
  }

  return dir + (dir.endsWith('/') ? '' : '/') + base;
};

export const relative = (from: string, to: string): string => {
  // Normalize paths
  from = resolve(from);
  to = resolve(to);

  if (from === to) {
    return '';
  }

  // Split paths into segments
  const fromParts = from.split('/').filter(Boolean);
  const toParts = to.split('/').filter(Boolean);

  // Find common prefix
  let i = 0;

  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
    i++;
  }

  // Build relative path
  const upCount = fromParts.length - i;
  const relativePath = [...Array(upCount).fill('..'), ...toParts.slice(i)];

  return relativePath.join('/') || '.';
};

// Also export as default for compatibility
export default {
  join,
  resolve,
  dirname,
  basename,
  extname,
  sep,
  delimiter,
  isAbsolute,
  normalize,
  parse,
  format,
  relative,
};
