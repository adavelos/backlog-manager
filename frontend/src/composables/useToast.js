import { reactive } from 'vue'

const state = reactive({ message: '', visible: false })
let hideTimer = null

export function showToast(message) {
  state.message = message
  state.visible = true
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    state.visible = false
  }, 2000)
}

export function useToast() {
  return { state, showToast }
}
