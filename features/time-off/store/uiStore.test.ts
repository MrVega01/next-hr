import { useUiStore } from '@/features/time-off/store/uiStore'

const initialState = {
  activePersona: 'employee' as const,
  selectedEmployeeId: null,
  optimisticRegistry: {},
  toasts: [],
}

beforeEach(() => {
  useUiStore.setState(initialState)
})

describe('initial state', () => {
  it('has expected defaults', () => {
    const state = useUiStore.getState()
    expect(state.activePersona).toBe('employee')
    expect(state.selectedEmployeeId).toBeNull()
    expect(state.optimisticRegistry).toEqual({})
    expect(state.toasts).toEqual([])
  })
})

describe('setActivePersona', () => {
  it('switches persona to manager', () => {
    useUiStore.getState().setActivePersona('manager')
    expect(useUiStore.getState().activePersona).toBe('manager')
  })

  it('switches persona back to employee', () => {
    useUiStore.getState().setActivePersona('manager')
    useUiStore.getState().setActivePersona('employee')
    expect(useUiStore.getState().activePersona).toBe('employee')
  })
})

describe('setSelectedEmployeeId', () => {
  it('sets the selected employee ID', () => {
    useUiStore.getState().setSelectedEmployeeId('emp-001')
    expect(useUiStore.getState().selectedEmployeeId).toBe('emp-001')
  })

  it('clears the selected employee ID with null', () => {
    useUiStore.getState().setSelectedEmployeeId('emp-001')
    useUiStore.getState().setSelectedEmployeeId(null)
    expect(useUiStore.getState().selectedEmployeeId).toBeNull()
  })
})

describe('registerOptimistic / unregisterOptimistic', () => {
  const entry = {
    requestId: 'req-temp-001',
    employeeId: 'emp-001',
    locationId: 'loc-nyc',
    balanceType: 'vacation',
    deltaApplied: -3,
    baseVersion: 'v-123',
    snapshotAvailableDays: 15,
    timestamp: Date.now(),
  }

  it('registers an optimistic entry and it appears in the registry', () => {
    useUiStore.getState().registerOptimistic('emp-001:loc-nyc:vacation', entry)
    const registry = useUiStore.getState().optimisticRegistry
    expect(registry['emp-001:loc-nyc:vacation']).toEqual(entry)
  })

  it('unregisters an optimistic entry and it is removed from the registry', () => {
    useUiStore.getState().registerOptimistic('emp-001:loc-nyc:vacation', entry)
    useUiStore.getState().unregisterOptimistic('emp-001:loc-nyc:vacation')
    const registry = useUiStore.getState().optimisticRegistry
    expect(registry['emp-001:loc-nyc:vacation']).toBeUndefined()
  })

  it('does not remove other entries when unregistering one', () => {
    const otherEntry = { ...entry, requestId: 'req-temp-002', balanceType: 'sick' }
    useUiStore.getState().registerOptimistic('emp-001:loc-nyc:vacation', entry)
    useUiStore.getState().registerOptimistic('emp-001:loc-nyc:sick', otherEntry)
    useUiStore.getState().unregisterOptimistic('emp-001:loc-nyc:vacation')

    const registry = useUiStore.getState().optimisticRegistry
    expect(registry['emp-001:loc-nyc:vacation']).toBeUndefined()
    expect(registry['emp-001:loc-nyc:sick']).toEqual(otherEntry)
  })
})

describe('addToast / removeToast', () => {
  it('adds a toast and it appears in the array with an id', () => {
    const toast = {
      id: 'toast-001',
      type: 'success' as const,
      message: 'Request submitted!',
    }
    useUiStore.getState().addToast(toast)
    const { toasts } = useUiStore.getState()
    expect(toasts).toHaveLength(1)
    expect(toasts[0].id).toBe('toast-001')
    expect(toasts[0].message).toBe('Request submitted!')
  })

  it('removes a toast by id', () => {
    useUiStore.getState().addToast({ id: 'toast-001', type: 'success', message: 'OK' })
    useUiStore.getState().addToast({ id: 'toast-002', type: 'error', message: 'Fail' })

    useUiStore.getState().removeToast('toast-001')
    const { toasts } = useUiStore.getState()
    expect(toasts).toHaveLength(1)
    expect(toasts[0].id).toBe('toast-002')
  })

  it('adding multiple toasts accumulates them', () => {
    useUiStore.getState().addToast({ id: 'a', type: 'info', message: 'A' })
    useUiStore.getState().addToast({ id: 'b', type: 'warning', message: 'B' })
    expect(useUiStore.getState().toasts).toHaveLength(2)
  })
})
