import { createContext, useCallback, useContext, useRef, useState } from 'react'

interface ToastState {
  message: string
  onUndo: () => void
}

interface UndoToastContextValue {
  show: (message: string, onUndo: () => void) => void
}

const UndoToastContext = createContext<UndoToastContextValue | undefined>(undefined)

const AUTO_DISMISS_MS = 6000

export function UndoToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((message: string, onUndo: () => void) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast({ message, onUndo })
    timerRef.current = setTimeout(() => setToast(null), AUTO_DISMISS_MS)
  }, [])

  const dismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast(null)
  }

  return (
    <UndoToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-16 z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => {
                toast.onUndo()
                dismiss()
              }}
              className="font-semibold text-indigo-300 dark:text-indigo-600"
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </UndoToastContext.Provider>
  )
}

export function useUndoToast(): UndoToastContextValue {
  const ctx = useContext(UndoToastContext)
  if (!ctx) throw new Error('useUndoToast must be used within UndoToastProvider')
  return ctx
}
