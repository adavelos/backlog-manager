import { reactive } from 'vue'

// Generic promise-based prompt/confirm dialog, rendered by components/common/Modal.vue.
// For anything with a bespoke body (e.g. the item detail editor) use a dedicated
// component instead of this — it only covers title/message/single-input + buttons.

const state = reactive({
  visible: false,
  title: '',
  message: '',
  showInput: false,
  inputPlaceholder: '',
  inputValue: '',
  buttons: [],
})

let resolveFn = null

function openModal({ title, message, showInput = false, inputPlaceholder = '', inputValue = '', buttons }) {
  return new Promise((resolve) => {
    resolveFn = resolve
    Object.assign(state, {
      visible: true,
      title: title || '',
      message: message || '',
      showInput,
      inputPlaceholder,
      inputValue,
      buttons,
    })
  })
}

function resolveModal(value) {
  state.visible = false
  if (resolveFn) {
    resolveFn(value)
    resolveFn = null
  }
}

function showPrompt(title, message, placeholder) {
  return openModal({
    title,
    message,
    showInput: true,
    inputPlaceholder: placeholder || '',
    buttons: [
      { label: 'Cancel', value: '__cancel__', className: 'modal-btn-cancel' },
      { label: 'OK', className: 'modal-btn-primary', useInputValue: true },
    ],
  }).then((val) => (val === '__cancel__' || val === null ? null : val))
}

function showConfirm(title, message) {
  return openModal({
    title,
    message,
    showInput: false,
    buttons: [
      { label: 'Cancel', value: '__cancel__', className: 'modal-btn-cancel' },
      { label: 'Confirm', value: '__confirm__', className: 'modal-btn-danger', focused: true },
    ],
  }).then((val) => val === '__confirm__')
}

export function useModal() {
  return { state, resolveModal, showPrompt, showConfirm }
}
