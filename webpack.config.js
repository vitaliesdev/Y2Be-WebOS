import CopyPlugin from 'copy-webpack-plugin';
import { TransformAsyncModulesPlugin } from 'transform-async-modules-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import pkgJson from './package.json' with { type: 'json' };
import webpack from 'webpack';
import { createRequire } from 'node:module';
import { basename } from 'node:path';

const require = createRequire(import.meta.url);

/** Babel options (targets come from `browserslist` in package.json). */
const babelOptions = {
  babelrc: false,
  configFile: false,
  cacheDirectory: true,
  // Fixes "TypeError: __webpack_require__(...) is not a function"
  // https://github.com/webpack/webpack/issues/9379#issuecomment-509628205
  sourceType: 'unambiguous',
  assumptions: { noNewArrows: true },
  plugins: [
    [
      '@babel/plugin-transform-runtime',
      {
        regenerator: false,
        version: require('@babel/runtime-corejs3/package.json').version
      }
    ],
    [
      'polyfill-corejs3',
      {
        method: 'usage-pure',
        version: require('core-js-pure/package.json').version,
        exclude: [
          // Pure polyfills break wrapping JSON.parse, which the app relies on.
          'es.json.parse',
          'esnext.json.parse',
          // Chrome 53 has URL and URLSearchParams with everything we use;
          // core-js only flags them for minor spec gaps (~60 KB unminified).
          /^web\.url/
        ]
      }
    ]
  ],
  presets: [
    ['@babel/preset-env', { bugfixes: true }],
    [
      '@babel/preset-typescript',
      {
        allExtensions: true, // TODO: remove for Babel 8
        disallowAmbiguousJSXLike: true,
        rewriteImportExtensions: true
      }
    ]
  ]
};

/**
 * @param input {Buffer<ArrayBufferLike>}
 * @returns {string}
 */
function transformAppInfo(input) {
  const appInfo = JSON.parse(input.toString());
  appInfo.version = pkgJson.version;
  return JSON.stringify(appInfo, null, 2);
}

/** @type {(env: Record<string, string>, argv: { mode?: string }) => (import('webpack').Configuration)[]} */
const makeConfig = (_env, argv) => [
  {
    devtool: argv.mode === 'development' ? 'inline-source-map' : 'source-map',

    optimization: {
      /**
       * terser doesn't pickup browserlist config
       * See: https://github.com/terser/terser/issues/235
       */
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            ecma: 2015,
            // Debug logging (e.g. on every `timeupdate`) is only useful in
            // development builds.
            compress: { pure_funcs: ['console.debug'] }
          }
        })
      ]
    },

    entry: {
      index: './src/launcher/launcher.js',
      userScript: {
        import: './src/main',
        filename: 'webOSUserScripts/[name].js'
      }
    },

    resolve: {
      extensions: ['.mjs', '.cjs', '.js', '.json', '.ts']
    },

    module: {
      rules: [
        {
          test: /\.[mc]?[jt]s$/i,

          loader: 'babel-loader',
          exclude: [
            // Some module should not be transpiled by Babel
            // See https://github.com/zloirock/core-js/issues/743#issuecomment-572074215
            // \\ for Windows, / for macOS and Linux
            /node_modules[\\/]core-js/,
            /node_modules[\\/]webpack[\\/]buildin/
          ],
          options: babelOptions,
          resolve: {
            // File extension DON'T MATTER in a bundler.
            fullySpecified: false
          }
        },
        {
          test: /\.css$/i,
          use: [
            { loader: 'style-loader' },
            {
              loader: 'css-loader',
              options: { esModule: false, importLoaders: 1 }
            },
            'postcss-loader'
          ]
        }
      ]
    },

    plugins: [
      new CopyPlugin({
        patterns: [
          {
            context: 'assets',
            from: '**/*',
            transform: {
              transformer(input, absolutePath) {
                if (basename(absolutePath) === 'appinfo.json') {
                  return transformAppInfo(input);
                }
                return input;
              }
            }
          },
          { context: 'src/launcher', from: 'index.html' }
        ]
      }),
      // babel doesn't transform top-level await.
      // webpack transforms it to async modules.
      // This plugin calls babel again to transform remove the `async` keyword usage after the fact.
      new TransformAsyncModulesPlugin({
        runtime: {
          version: pkgJson.dependencies['@babel/runtime-corejs3'],
          absoluteRuntime: './node_modules/@babel/runtime-corejs3'
        }
      }),
      new webpack.DefinePlugin({
        __APP_VERSION__: JSON.stringify(pkgJson.version)
      })
    ]
  }
];

export default makeConfig;
