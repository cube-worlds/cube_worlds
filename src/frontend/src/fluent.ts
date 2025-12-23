import enMessages from '#root/../locales/en.ftl?raw'
import ruMessages from '#root/../locales/ru.ftl?raw'
import { FluentBundle, FluentResource } from '@fluent/bundle'
import { createFluentVue } from 'fluent-vue'

export const enBundle = new FluentBundle('en')
export const ruBundle = new FluentBundle('ru')

enBundle.addResource(new FluentResource(enMessages))
ruBundle.addResource(new FluentResource(ruMessages))

export const fluent = createFluentVue({
  bundles: [enBundle, ruBundle],
})
