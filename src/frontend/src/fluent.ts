import { FluentBundle, FluentResource } from "@fluent/bundle";
import ruMessages from "../../../locales/ru.ftl?raw";
import enMessages from "../../../locales/en.ftl?raw";
import { createFluentVue } from "fluent-vue";

export const enBundle = new FluentBundle("en")
export const ruBundle = new FluentBundle("ru")
enBundle.addResource(new FluentResource(enMessages))
ruBundle.addResource(new FluentResource(ruMessages))

export const fluent = createFluentVue({
  bundles: [enBundle, ruBundle],
})
