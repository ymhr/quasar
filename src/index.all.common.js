import install from './install.js'
import { version } from '../package.json'
import i18n from './i18n.js'
import icons from './icons.js'
import ssrUpdate from './ssr-update.js'

export * from './components.js'
export * from './directives.js'
export * from './plugins.js'
export * from './utils.js'

const theme = process.env.THEME

export const Quasar = {
  version,
  install,
  i18n,
  icons,
  theme,
  ssrUpdate
}
