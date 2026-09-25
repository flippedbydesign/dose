import { updateSettings, useSettings } from '../../hooks/useSettings'

export function DisclaimerGate({ children }: { children: React.ReactNode }) {
  const settings = useSettings()

  if (settings.disclaimerAcknowledged) return <>{children}</>

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-semibold">Welcome to Dose</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Dose is a personal tracker and calculator. It does not recommend doses, protocols, or compounds — every dose,
          phase, and schedule is whatever you enter. Reconstitution math and forecasts are calculated from the numbers
          you provide; always double-check them yourself. Your data stays on this device.
        </p>
        <button
          type="button"
          onClick={() => updateSettings({ disclaimerAcknowledged: true })}
          className="mt-5 min-h-[44px] w-full rounded-lg bg-indigo-600 text-sm font-semibold text-white active:bg-indigo-700"
        >
          I understand
        </button>
      </div>
    </div>
  )
}
