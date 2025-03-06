// Browser-compatible path utilities
import type { ParsedPath } from 'path';

// Import our custom implementation of path-browserify
import pathBrowserify from '~/utils/path-browserify-shim';

/**
 * A browser-compatible path utility that mimics Node's path module
 * Using our custom implementation for consistent behavior in browser environments
 */
export const path = {
  join: (...paths: string[]): string => pathBrowserify.join(...paths),
  dirname: (path: string): string => pathBrowserify.dirname(path),
  basename: (path: string, ext?: string): string => pathBrowserify.basename(path, ext),
  extname: (path: string): string => pathBrowserify.extname(path),
  relative: (from: string, to: string): string => pathBrowserify.relative(from, to),
  isAbsolute: (path: string): boolean => pathBrowserify.isAbsolute(path),
  normalize: (path: string): string => pathBrowserify.normalize(path),
  parse: (path: string): ParsedPath => pathBrowserify.parse(path),
  format: (pathObject: ParsedPath): string => pathBrowserify.format(pathObject),
} as const;
