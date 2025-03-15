import { FluentBundle, FluentResource } from '@fluent/bundle'
import { createFluentVue } from 'fluent-vue'
import enMessages from '../../../locales/en.ftl?raw'
import ruMessages from '../../../locales/ru.ftl?raw'

export const enBundle = new FluentBundle('en')
export const ruBundle = new FluentBundle('ru')
enBundle.addResource(new FluentResource(enMessages))
ruBundle.addResource(new FluentResource(ruMessages))

export const fluent = createFluentVue({
  bundles: [enBundle, ruBundle],
})
