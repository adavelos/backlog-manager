export function onTabInsert(e) {
  if (e.key !== 'Tab') return
  e.preventDefault()
  const el = e.target
  const start = el.selectionStart
  const end = el.selectionEnd
  const value = el.value
  el.value = value.substring(0, start) + '\t' + value.substring(end)
  el.selectionStart = el.selectionEnd = start + 1
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
