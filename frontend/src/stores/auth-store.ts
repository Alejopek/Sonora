import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getMe, login, register, type SessionUser } from '../services/api'

const DEV_CREDENTIALS = import.meta.env.DEV ? {
  email: 'dev@sonora.local',
  password: 'devpassword123',
  user: {
    id: 999,
    username: 'Developer',
    email: 'dev@sonora.local',
    created_at: '2025-01-01T00:00:00.000Z',
  },
  token: 'dev-mock-session-token',
} : null

type AuthState = { token: string | null; user: SessionUser | null; loading: boolean; error: string | null; signIn: (email: string, password: string) => Promise<void>; signUp: (username: string, email: string, password: string) => Promise<void>; restore: () => Promise<void>; signOut: () => void; clearError: () => void }
export const useAuthStore = create<AuthState>()(persist((set, get) => ({
  token: null, user: null, loading: false, error: null,
  signIn: async (email, password) => {
    set({ loading: true, error: null })
    if (DEV_CREDENTIALS && email.trim().toLowerCase() === DEV_CREDENTIALS.email && password === DEV_CREDENTIALS.password) {
      set({ token: DEV_CREDENTIALS.token, user: DEV_CREDENTIALS.user, loading: false })
      return
    }
    try {
      const session = await login(email, password)
      set({ token: session.token, user: session.user })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'No se pudo iniciar sesión.' })
      throw error
    } finally {
      set({ loading: false })
    }
  },
  signUp: async (username, email, password) => { set({ loading: true, error: null }); try { const session = await register(username, email, password); set({ token: session.token, user: session.user }) } catch (error) { set({ error: error instanceof Error ? error.message : 'No se pudo crear la cuenta.' }); throw error } finally { set({ loading: false }) } },
  restore: async () => {
    const currentToken = get().token
    if (!currentToken) return
    if (DEV_CREDENTIALS && currentToken === DEV_CREDENTIALS.token) return
    try { set({ user: await getMe() }) } catch { set({ token: null, user: null }) }
  },
  signOut: () => set({ token: null, user: null, error: null }), clearError: () => set({ error: null }),
}), { name: 'sonora-auth', partialize: (state) => ({ token: state.token, user: state.user }) }))
