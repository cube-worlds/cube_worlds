import antfu from '@antfu/eslint-config'
import prettier from 'eslint-config-prettier'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default antfu({
  typescript: true,
  vue: true,
  stylistic: false,
  rules: {
    // 'style/brace-style': ['error', '1tbs', { allowSingleLine: true }],
    'vue/no-unused-vars': 'error',
    'vue/max-attributes-per-line': 'off',
    'vue/singleline-html-element-content-newline': 'off',
    'unicorn/number-literal-case': 'off',
    'vue/html-self-closing': 'off',
  },
  languageOptions: {
    sourceType: 'module',
    globals: {
      ...globals.browser,
    },
  },
  extends: [...pluginVue.configs['flat/recommended'], prettier],
})
