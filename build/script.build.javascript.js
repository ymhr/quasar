process.env.BABEL_ENV = 'production'

const
  path = require('path'),
  fs = require('fs'),
  rollup = require('rollup'),
  uglify = require('uglify-es'),
  buble = require('rollup-plugin-buble'),
  json = require('rollup-plugin-json'),
  vue = require('rollup-plugin-vue'),
  replace = require('rollup-plugin-replace'),
  nodeResolve = require('rollup-plugin-node-resolve'),
  buildConf = require('./build.conf'),
  buildUtils = require('./build.utils'),
  vueConfig = {
    compileTemplate: true,
    htmlMinifier: {collapseBooleanAttributes: false}
  }

const builds = [
  {
    rollup: {
      input: resolve(`src/index.esm.js`),
      output: {
        file: resolve(`dist/quasar.${buildConf.themeToken}.esm.js`),
        format: 'es'
      }
    },
    meta: { buildUnminified: true }
  },
  {
    rollup: {
      input: resolve('src/ie-compat/ie.js'),
      output: {
        file: resolve('dist/quasar.ie.polyfills.js'),
        format: 'es'
      }
    },
    meta: { buildUnminified: true }
  },
  {
    rollup: {
      input: resolve('src/ie-compat/ie.js'),
      output: {
        file: resolve('dist/umd/quasar.ie.polyfills.umd.js'),
        format: 'umd'
      }
    },
    meta: { buildMinified: true }
  },
  {
    rollup: {
      input: resolve(`src/index.umd.js`),
      output: {
        file: resolve(`dist/umd/quasar.${buildConf.themeToken}.umd.js`),
        format: 'umd'
      }
    },
    meta: {
      buildUnminified: true,
      buildMinified: true
    }
  }
]

addAssets(builds, 'i18n')
addAssets(builds, 'icons')

build(builds)

/**
 * Helpers
 */

function resolve (_path) {
  return path.resolve(__dirname, '..', _path)
}

function camel (str) {
  return str.charAt(0).toUpperCase() + str.substr(1)
}

function addAssets (builds, type) {
  const
    files = fs.readdirSync(resolve(type)),
    plugins = [ buble() ],
    camelType = camel(type)

  files.forEach(file => {
    const name = file.replace(/-([a-z])/g, g => g[1].toUpperCase())
    builds.push({
      rollup: {
        input: resolve(`${type}/${file}`),
        output: {
          file: addExtension(resolve(`dist/umd/${type}.${file}`), 'umd'),
          format: 'umd',
          name: `Quasar${camelType}${camel(name)}`
        },
        plugins
      },
      meta: {
        buildMinified: true
      }
    })
  })
}

function processEntries (entries) {
  const builds = []

  entries.forEach(entry => {
    if (entry.rollup.output.file.indexOf(buildConf.themeToken) === -1) {
      builds.push(entry)
      return
    }

    buildConf.themes.forEach(theme => {
      const clone = JSON.parse(JSON.stringify(entry))
      clone.rollup.output.file = entry.rollup.output.file.replace(buildConf.themeToken, theme)
      clone.meta.theme = theme
      builds.push(clone)
    })
  })

  return builds
}

function build (builds) {
  Promise
    .all(processEntries(builds).map(genConfig).map(buildEntry))
    .catch(buildUtils.logError)
}

function genConfig (opts) {
  const theme = opts.meta && opts.meta.theme
    ? opts.meta.theme
    : null

  const plugins = opts.meta.plugins || [
    nodeResolve({
      extensions: theme
        ? [`.${theme}.js`, '.js', `.${theme}.vue`, '.vue']
        : ['.js', '.vue'],
      preferBuiltins: false
    }),
    json(),
    vue(vueConfig),
    buble()
  ]

  if (theme) {
    plugins.push(
      replace({
        '__THEME__': JSON.stringify(theme)
      })
    )
  }

  opts.rollup.output.banner = buildConf.banner
  opts.rollup.output.name = opts.rollup.output.name || 'Quasar'
  opts.rollup.plugins = plugins

  if (opts.rollup.output.format === 'umd') {
    opts.rollup.output.globals = opts.rollup.output.globals || {}
    opts.rollup.output.globals.vue = 'Vue'

    opts.rollup.external = opts.rollup.external || []
    opts.rollup.external.push('vue')
  }

  return opts
}

function addExtension (filename, ext = 'min') {
  const insertionPoint = filename.lastIndexOf('.')
  return `${filename.slice(0, insertionPoint)}.${ext}${filename.slice(insertionPoint)}`
}

function buildEntry (config) {
  return rollup
    .rollup(config.rollup)
    .then(bundle => bundle.generate(config.rollup))
    .then(({ code }) => {
      return config.meta.buildUnminified
        ? buildUtils.writeFile(config.rollup.output.file, code)
        : code
    })
    .then(code => {
      if (!config.meta.buildMinified) {
        return code
      }

      const minified = uglify.minify(code, {
        compress: {
          pure_funcs: ['makeMap']
        }
      })

      if (minified.error) {
        return new Promise((resolve, reject) => reject(minified.error))
      }

      return buildUtils.writeFile(
        addExtension(config.rollup.output.file),
        (config.rollup.output.banner ? config.rollup.output.banner + '\n' : '') + minified.code,
        true
      )
    })
}
