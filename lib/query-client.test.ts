import { QueryKeys } from '@/lib/query-client'

describe('QueryKeys', () => {
  it('balance returns correct key tuple', () => {
    expect(QueryKeys.balance('emp-001', 'loc-nyc', 'vacation')).toEqual(['balance', 'emp-001', 'loc-nyc', 'vacation'])
  })

  it('balances returns correct key tuple', () => {
    expect(QueryKeys.balances('emp-001')).toEqual(['balances', 'emp-001'])
  })

  it('requests returns correct key tuple', () => {
    expect(QueryKeys.requests('emp-001')).toEqual(['requests', 'emp-001'])
  })
})
