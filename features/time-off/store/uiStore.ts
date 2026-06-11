import { create } from 'zustand'

interface OptimisticEntry {
  requestId: string
  employeeId: string
  locationId: string
  balanceType: string
  deltaApplied: number
  baseVersion: string
  snapshotAvailableDays: number
  timestamp: number
}

interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  requestId?: string
}

interface UiState {
  activePersona: 'employee' | 'manager'
  selectedEmployeeId: string | null
  optimisticRegistry: Record<string, OptimisticEntry>
  toasts: Toast[]
}

interface UiActions {
  setActivePersona: (persona: 'employee' | 'manager') => void
  setSelectedEmployeeId: (id: string | null) => void
  registerOptimistic: (key: string, entry: OptimisticEntry) => void
  unregisterOptimistic: (key: string) => void
  addToast: (toast: Toast) => void
  removeToast: (id: string) => void
}

type UiStore = UiState & UiActions

export const useUiStore = create<UiStore>((set) => ({
  // State
  activePersona: 'employee',
  selectedEmployeeId: null,
  optimisticRegistry: {},
  toasts: [],

  // Actions
  setActivePersona: (persona) => set({ activePersona: persona }),

  setSelectedEmployeeId: (id) => set({ selectedEmployeeId: id }),

  registerOptimistic: (key, entry) =>
    set((state) => ({
      optimisticRegistry: { ...state.optimisticRegistry, [key]: entry },
    })),

  unregisterOptimistic: (key) =>
    set((state) => {
      const next = { ...state.optimisticRegistry }
      delete next[key]
      return { optimisticRegistry: next }
    }),

  addToast: (toast) =>
    set((state) => ({ toasts: [...state.toasts, toast] })),

  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

// Typed selector hooks
export const useActivePersona = () => useUiStore((s) => s.activePersona)
export const useSelectedEmployeeId = () => useUiStore((s) => s.selectedEmployeeId)
export const useOptimisticRegistry = () => useUiStore((s) => s.optimisticRegistry)
export const useToasts = () => useUiStore((s) => s.toasts)
