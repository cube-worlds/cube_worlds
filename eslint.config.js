import antfu from '@antfu/eslint-config'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default antfu({
    typescript: true,
    vue: true,
    stylistic: {
        indent: 4,
        quotes: 'single',
        semi: false,
    },
    rules: {
        'style/brace-style': ['error', '1tbs', { allowSingleLine: true }],
        'vue/no-unused-vars': 'error',
    },
    languageOptions: {
        sourceType: 'module',
        globals: {
            ...globals.browser,
        },
    },
}, ...pluginVue.configs['flat/recommended'])
