declare module '*.vue' {
  import type Vue from 'vue'

  const value: Vue.ComponentOptions<Vue>
  export default value
}
