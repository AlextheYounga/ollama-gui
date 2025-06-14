import { ref } from 'vue'

export const useConfirmDialog = () => {
  const isOpen = ref(false)
  const message = ref('')
  const title = ref('')
  const confirmText = ref('Confirm')
  const cancelText = ref('Cancel')
  let resolvePromise: ((value: boolean) => void) | null = null

  const confirm = (options: {
    message: string
    title?: string
    confirmText?: string
    cancelText?: string
  }): Promise<boolean> => {
    message.value = options.message
    title.value = options.title || 'Confirm'
    confirmText.value = options.confirmText || 'Confirm'
    cancelText.value = options.cancelText || 'Cancel'
    isOpen.value = true

    return new Promise((resolve) => {
      resolvePromise = resolve
    })
  }

  const handleConfirm = () => {
    isOpen.value = false
    if (resolvePromise) {
      resolvePromise(true)
      resolvePromise = null
    }
  }

  const handleCancel = () => {
    isOpen.value = false
    if (resolvePromise) {
      resolvePromise(false)
      resolvePromise = null
    }
  }

  return {
    isOpen,
    message,
    title,
    confirmText,
    cancelText,
    confirm,
    handleConfirm,
    handleCancel,
  }
} 