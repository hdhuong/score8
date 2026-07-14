import { useEffect, useState } from 'react'
import { useTournamentStore } from './store/tournamentStore'
import SetupScreen from './components/SetupScreen'
import ScheduleScreen from './components/ScheduleScreen'
import LeaderboardScreen from './components/LeaderboardScreen'
import HistoryScreen from './components/HistoryScreen'
import SettingsScreen from './components/SettingsScreen'
import BottomTabs, { type Tab } from './components/BottomTabs'

export default function App() {
  const hasTournament = useTournamentStore((s) => s.teams.length > 0)
  const hasHistory = useTournamentStore((s) => s.history.length > 0)
  const [tab, setTab] = useState<Tab>('schedule')

  // App không unmount khi chuyển SetupScreen <-> tab view, nên tab cũ có thể
  // còn sót lại từ giải trước. Luôn về "Lịch" mỗi khi có 1 giải (mới) sẵn sàng.
  useEffect(() => {
    if (hasTournament) setTab('schedule')
  }, [hasTournament])

  // Chưa từng có giải nào (kể cả trong lịch sử) -> chỉ có việc để làm là tạo giải,
  // không cần hiện tab bar.
  if (!hasTournament && !hasHistory) {
    return <SetupScreen />
  }

  return (
    <div className="min-h-full">
      {tab === 'schedule' && (hasTournament ? <ScheduleScreen /> : <SetupScreen />)}
      {tab === 'leaderboard' && <LeaderboardScreen />}
      {tab === 'history' && <HistoryScreen />}
      {tab === 'settings' && <SettingsScreen />}
      <BottomTabs active={tab} onChange={setTab} />
    </div>
  )
}
