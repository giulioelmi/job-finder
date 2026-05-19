;(function () {
  chrome.storage.local.get(['cover_letter_draft'], ({ cover_letter_draft }) => {
    if (cover_letter_draft) {
      window.postMessage({ type: 'BAMBOO_COVER_LETTER', payload: cover_letter_draft }, '*')
      chrome.storage.local.remove(['cover_letter_draft'])
    }
  })
})()
