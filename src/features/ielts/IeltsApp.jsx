import { useLocation } from 'react-router-dom'
import { IeltsProvider } from './context/IeltsContext.jsx'
import IeltsShell from './IeltsShell.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ReadingPage from './pages/ReadingPage.jsx'
import ListeningPage from './pages/ListeningPage.jsx'
import MistakesPage from './pages/MistakesPage.jsx'
import SetsPage from './pages/SetsPage.jsx'
import ReviewPage from './pages/ReviewPage.jsx'
import WritingPage from './pages/WritingPage.jsx'
import SpeakingPage from './pages/SpeakingPage.jsx'
import VocabPage from './pages/VocabPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import { EmptyState } from './components/ui.jsx'

const PAGES = {
  '/ielts': DashboardPage,
  '/ielts/reading': ReadingPage,
  '/ielts/listening': ListeningPage,
  '/ielts/mistakes': MistakesPage,
  '/ielts/sets': SetsPage,
  '/ielts/review': ReviewPage,
  '/ielts/writing': WritingPage,
  '/ielts/speaking': SpeakingPage,
  '/ielts/vocab': VocabPage,
  '/ielts/settings': SettingsPage,
}
export default function IeltsApp() {
  const { pathname } = useLocation()
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname
  const Page = PAGES[normalized]
  return (
    <IeltsProvider>
      <IeltsShell>
        {Page ? <Page /> : <EmptyState icon="404" title="没有这个雅思页面">请从左侧导航选择阅读、听力、写作口语、词块或设置。</EmptyState>}
      </IeltsShell>
    </IeltsProvider>
  )
}
