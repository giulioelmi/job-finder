'use client'

import { useEffect, useRef, useState } from 'react'

interface CoverLetterPayload {
  coverLetter: string
  jobTitle?: string
  company?: string
}

type State =
  | { status: 'loading' }
  | { status: 'loaded'; payload: CoverLetterPayload }
  | { status: 'error' }

export default function CoverLetterPage() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [text, setText] = useState('')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data?.type !== 'BAMBOO_COVER_LETTER') return
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      const payload = event.data.payload as CoverLetterPayload
      setState({ status: 'loaded', payload })
      setText(payload.coverLetter ?? '')
    }

    window.addEventListener('message', onMessage)
    timeoutRef.current = setTimeout(() => setState({ status: 'error' }), 5000)

    return () => {
      window.removeEventListener('message', onMessage)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  function handleDownload() {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Cover Letter</title>
<style>
  @page { margin: 0; size: letter; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 12pt;
    line-height: 1.4;
    padding: 1in;
    white-space: pre-wrap;
    color: #000;
    box-sizing: border-box;
  }
</style>
</head>
<body>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body>
</html>`)
    win.document.close()
    win.focus()
    win.print()
  }

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Loading your cover letter…</p>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-2 max-w-sm px-4">
          <p className="text-gray-700 font-medium">Could not load cover letter</p>
          <p className="text-sm text-gray-500">Please try again from the extension.</p>
        </div>
      </div>
    )
  }

  const { payload } = state
  const subtitle = [payload.jobTitle, payload.company].filter(Boolean).join(' · ')

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-green-700 rounded-md flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
              <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
            </svg>
          </div>
          <span className="font-bold text-gray-900">Bamboo</span>
          {subtitle && <span className="text-sm text-gray-400 hidden sm:inline">{subtitle}</span>}
        </div>
        <button
          onClick={handleDownload}
          className="bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-green-800 transition-colors"
        >
          Download PDF
        </button>
      </header>
      <main className="flex-1 p-6">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          className="w-full h-full min-h-[70vh] border border-gray-300 rounded-lg p-6 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 resize-none bg-white shadow-sm"
          spellCheck
        />
      </main>
    </div>
  )
}
