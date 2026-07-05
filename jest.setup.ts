import '@testing-library/jest-dom'

process.env.SESSION_SECRET ??= 'test-session-secret-value-at-least-32-bytes'

// jsdom does not implement HTMLDialogElement.showModal/close — polyfill for tests.
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true
    }
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () {
      this.open = false
      this.dispatchEvent(new Event('close'))
    }
  }
}
