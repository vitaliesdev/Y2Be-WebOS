// Builds and packages an IPK for webOS 4 and newer only (Chrome 53+).
// Smaller and less transpiled than the regular build, which supports webOS 1+.
// Output: ./webos4/youtube.leanback.v4_<version>_all.ipk
import { spawnSync } from 'node:child_process';
import { normalize } from 'node:path';

const env = {
  ...process.env,
  YTAF_TARGET: 'webos4',
  // Used by babel (via `targets`), postcss-preset-env and es-check.
  BROWSERSLIST: 'chrome 53'
};

/**
 * @param {string} bin
 * @param {string[]} args
 */
function run(bin, args) {
  const { status } = spawnSync(normalize(`./node_modules/.bin/${bin}`), args, {
    stdio: 'inherit',
    shell: true,
    env
  });
  if (status !== 0) process.exit(status ?? 1);
}

run('webpack', ['--mode=production']);
run('es-check', []);
run('ares-package', ['-n', 'dist', '-o', 'webos4']);
