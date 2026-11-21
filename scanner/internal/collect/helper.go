package collect

// HelperFlag starts the executable as the Linux root helper (feature 007 FR-006). The window
// process passes it through pkexec; it is the only argument the helper accepts.
const HelperFlag = "--privileged-helper"
