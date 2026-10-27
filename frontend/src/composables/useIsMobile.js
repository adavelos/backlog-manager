import { ref } from 'vue'

// One viewport check for the whole app, shared by every caller. It follows window resizes and
// rotations, so the same URL shows the phone screens on a narrow window and the desktop ones on a wide one.
const mql = window.matchMedia('(max-width: 720px)')
const isMobile = ref(mql.matches)
mql.addEventListener('change', (e) => {
  isMobile.value = e.matches
})

export function useIsMobile() {
  return isMobile
}
