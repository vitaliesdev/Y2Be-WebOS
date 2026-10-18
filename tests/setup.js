// Loaded with `node --import` before the tests: resolves extensionless and
// directory imports the way webpack does.
import { registerHooks } from 'node:module';

const CANDIDATES = ['.js', '.ts', '/index.js', '/index.ts'];

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      const notFound =
        err instanceof Error &&
        'code' in err &&
        err.code === 'ERR_MODULE_NOT_FOUND';
      if (!notFound || !specifier.startsWith('.')) throw err;

      for (const suffix of CANDIDATES) {
        try {
          return nextResolve(specifier + suffix, context);
        } catch {
          // try the next candidate
        }
      }
      throw err;
    }
  }
});
