import AppShell from '@/components/app-shell'
import { requireUser } from '@/lib/session'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  return <AppShell role={user.role}>{children}</AppShell>
}
