import antfu from '@antfu/eslint-config'

export default antfu({
    typescript: true,
    stylistic: {
        indent: 4,
        quotes: 'single',
    },
    rules: {
        'style/brace-style': ['error', '1tbs', { allowSingleLine: true }],
    },
})
