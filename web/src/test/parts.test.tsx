// Part lookups in the result screen's scan specs (feature 018): badges, sentence and source link per
// part (FR-004), "Looking up…" while pending, the unchanged card without lookups (FR-007), mock data (FR-008).
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { DeviceScan } from '@leaaf/shared/device'
import type { PartLookup } from '@leaaf/shared/parts'
import laptopScanJson from '@leaaf/fixtures/device-scan.laptop-complete.json'
import { ApiContext } from '../api'
import { createMockClient, MOCK_DEVICE_IDS } from '../api/mock'
import { laptopPartLookups } from '../api/mockParts'
import { ResultsView } from '../components/ResultsView'
import { SpecsCard } from '../components/SpecsCard'

afterEach(cleanup)

const scan = laptopScanJson as unknown as DeviceScan
const lookups = laptopPartLookups(MOCK_DEVICE_IDS.laptop).parts

/** The row of the scan specs with this label. */
const row = (label: string) => within(screen.getByRole('region', { name: 'Your device' })).getByText(label).parentElement!

describe('SpecsCard part lookups (AC-004)', () => {
  it('shows "Looking up…" under each part row while the lookups load', () => {
    render(<SpecsCard scan={scan} parts={null} />)
    for (const label of ['Battery health', 'Storage', 'Memory', 'Processor', 'Graphics']) expect(row(label)).toHaveTextContent('Looking up…')
    expect(row('Security chip')).not.toHaveTextContent('Looking up…')
  })

  it('shows the badge, sentence and source link of each part', () => {
    render(<SpecsCard scan={scan} parts={lookups} />)
    const byKind = (kind: PartLookup['kind']) => lookups.find((p) => p.kind === kind)!

    const cpu = row('Processor')
    expect(cpu).toHaveTextContent('Knowledge base')
    expect(cpu).toHaveTextContent(byKind('cpu').sentence!)
    expect(within(cpu).getByRole('link')).toHaveAttribute('href', byKind('cpu').source!.url)
    expect(within(cpu).getByRole('link')).not.toHaveTextContent('Web source')

    const memory = row('Memory')
    expect(memory).toHaveTextContent('Web search · check')
    expect(within(memory).getByRole('link')).toHaveAttribute('href', byKind('memory').source!.url)
    expect(within(memory).getByRole('link')).toHaveTextContent('Web source')

    const gpu = row('Graphics')
    expect(gpu).toHaveTextContent('No match')
    expect(within(gpu).queryByRole('link')).toBeNull()

    expect(row('Storage')).toHaveTextContent('Knowledge base')
    expect(row('Battery health')).toHaveTextContent('Web search · check')
    expect(screen.queryByText('Looking up…')).toBeNull()
  })

  it('names each part when a row has several', () => {
    const drives: PartLookup[] = [
      { part_id: 'storage-0', kind: 'storage', identifier: 'NVMe SSD', status: 'no_match', sentence: null, source: null },
      { part_id: 'storage-1', kind: 'storage', identifier: 'Hard disk drive', status: 'no_match', sentence: null, source: null },
    ]
    render(<SpecsCard scan={scan} parts={drives} />)
    expect(row('Storage')).toHaveTextContent('NVMe SSD')
    expect(row('Storage')).toHaveTextContent('Hard disk drive')
    expect(row('Processor')).not.toHaveTextContent('No match')
  })

  it('looks as before without lookups (AC-007)', () => {
    const { container: without } = render(<SpecsCard scan={scan} />)
    const before = without.innerHTML
    cleanup()
    const { container } = render(<SpecsCard scan={scan} parts={[]} />)
    expect(container.innerHTML).toBe(before)
    expect(screen.queryByText(/Knowledge base|Web search · check|No match|Looking up…/)).toBeNull()
  })
})

describe('part lookups on the result screen (AC-008)', () => {
  it('shows "Looking up…", then the sample lookups with every badge in mock mode', async () => {
    const api = createMockClient({ stepMs: 5, assessmentMs: 5, reportMs: 5, stepsMs: 5, partsMs: 80 })
    render(<ApiContext.Provider value={api}><ResultsView deviceId={MOCK_DEVICE_IDS.laptop} /></ApiContext.Provider>)
    expect((await screen.findAllByText('Looking up…')).length).toBeGreaterThan(0)
    expect(await screen.findAllByText('Knowledge base')).toHaveLength(2)
    expect(screen.getAllByText('Web search · check')).toHaveLength(2)
    expect(screen.getAllByText('No match')).toHaveLength(1)
    expect(screen.queryByText('Looking up…')).toBeNull()
  })

  it('shows the sample desktop without lookups', async () => {
    const api = createMockClient({ stepMs: 5, assessmentMs: 5, reportMs: 5, stepsMs: 5, partsMs: 5 })
    render(<ApiContext.Provider value={api}><ResultsView deviceId={MOCK_DEVICE_IDS.desktop} /></ApiContext.Provider>)
    await screen.findByRole('region', { name: 'Your device' })
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(screen.queryByText(/Knowledge base|Web search · check|No match|Looking up…/)).toBeNull()
  })
})

describe('privacy notice (FR-009)', () => {
  it('says that only part names go to the search services, in German and English (AC-009)', async () => {
    const { legalDoc } = await import('../legal/content')
    const text = (lang: 'de' | 'en') => legalDoc('privacy', lang).blocks.map((b) => ('text' in b ? b.text : '')).join(' ')
    expect(text('en')).toContain("we send only the component's name")
    expect(text('en')).toContain('no other scan data')
    expect(text('de')).toContain('nur die Bezeichnung des Bauteils')
    expect(text('de')).toContain('keine anderen Scan-Daten')
  })
})
