/**
 * @server-only
 *
 * Server-side path utilities that use the Node.js path module
 */
import * as nodePath from 'path';
import type { ParsedPath } from 'path';

/**
 * A server-side path utility that uses Node's path module
 * This should only be imported in server-side code
 */
export const path = {
  join: (...paths: string[]): string => nodePath.join(...paths),
  dirname: (path: string): string => nodePath.dirname(path),
  basename: (path: string, ext?: string): string => nodePath.basename(path, ext),
  extname: (path: string): string => nodePath.extname(path),
  relative: (from: string, to: string): string => nodePath.relative(from, to),
  isAbsolute: (path: string): boolean => nodePath.isAbsolute(path),
  normalize: (path: string): string => nodePath.normalize(path),
  parse: (path: string): ParsedPath => nodePath.parse(path),
  format: (pathObject: ParsedPath): string => nodePath.format(pathObject),
} as const;
