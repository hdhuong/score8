export type Tab = 'schedule' | 'leaderboard' | 'history' | 'settings'

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'schedule', label: 'Lịch', icon: '📅' },
  { id: 'leaderboard', label: 'BXH', icon: '🏆' },
  { id: 'history', label: 'Lịch sử', icon: '📜' },
  { id: 'settings', label: 'Cài đặt', icon: '⚙️' },
]

export default function BottomTabs({ active, onChange }: Props) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-700 bg-slate-900/95 backdrop-blur">
      <div className="mx-auto flex max-w-md">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs ${
              active === tab.id ? 'text-sky-400' : 'text-slate-500'
            }`}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
