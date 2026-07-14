import { useEffect, useState } from 'react'
import { useTournamentStore } from './store/tournamentStore'
import SetupScreen from './components/SetupScreen'
import ScheduleScreen from './components/ScheduleScreen'
import LeaderboardScreen from './components/LeaderboardScreen'
import SettingsScreen from './components/SettingsScreen'
import BottomTabs, { type Tab } from './components/BottomTabs'

export default function App() {
  const hasTournament = useTournamentStore((s) => s.teams.length > 0)
  const [tab, setTab] = useState<Tab>('schedule')

  // App không unmount khi chuyển SetupScreen <-> 3-tab view, nên tab cũ có thể
  // còn sót lại từ giải trước. Luôn về "Lịch" mỗi khi có 1 giải (mới) sẵn sàng.
  useEffect(() => {
    if (hasTournament) setTab('schedule')
  }, [hasTournament])

  if (!hasTournament) {
    return <SetupScreen />
  }

  return (
    <div className="min-h-full">
      {tab === 'schedule' && <ScheduleScreen />}
      {tab === 'leaderboard' && <LeaderboardScreen />}
      {tab === 'settings' && <SettingsScreen />}
      <BottomTabs active={tab} onChange={setTab} />
    </div>
  )
}
