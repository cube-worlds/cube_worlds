import antfu from '@antfu/eslint-config'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default antfu({
  typescript: true,
  stylistic: false,
  rules: {
    'unicorn/number-literal-case': 'off',
  },
  languageOptions: {
    sourceType: 'module',
    globals: {
      ...globals.browser,
    },
  },
  extends: [prettier],
})
