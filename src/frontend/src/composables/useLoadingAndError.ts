import { ElLoading, ElMessage } from 'element-plus'

export default function useLoadingAndError() {
    const loadingInstance = ElLoading.service({
        fullscreen: true,
        visible: false,
    })

    async function showError(error: unknown) {
        loadingInstance.visible.value = false
        const message = (error as Error)?.message ?? error
        ElMessage({
            showClose: true,
            message,
            type: 'error',
        })
        console.error('There was a problem: ', message)
    }

    return {
        loadingInstance,
        showError,
    }
}
