import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

const IeltsApp = lazy(() => import('./features/ielts/IeltsApp.jsx'))

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <Routes>
        <Route path="/" element={<Navigate to="/ielts" replace />} />
        <Route path="/ielts/*" element={<IeltsApp />} />
        <Route path="*" element={<Navigate to="/ielts" replace />} />
      </Routes>
    </Suspense>
  )
}
