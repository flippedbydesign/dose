interface EmptyStateProps {
  title: string
  action?: { label: string; onClick: () => void }
  icon?: React.ReactNode
}

export function EmptyState({ title, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon && <div className="text-slate-300 dark:text-slate-700">{icon}</div>}
      <p className="text-slate-500 dark:text-slate-400">{title}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="min-h-[44px] rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white active:bg-indigo-700"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
