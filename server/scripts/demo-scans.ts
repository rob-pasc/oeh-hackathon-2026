// Synthetic scans of the three demo models for the live smoke scripts (features 008 and 009).
// No real scans of the demo models exist yet, so each scan is the fictional example laptop with the
// model's identity and typical hardware (RAM soldering, battery wear) filled in.
import { readFileSync } from 'node:fs'
import type { DeviceScan } from '@leaaf/shared'

const base = JSON.parse(
  readFileSync(new URL('../../shared/fixtures/device-scan.laptop-complete.json', import.meta.url), 'utf8'),
) as DeviceScan

function demoScan(identity: Partial<DeviceScan['identity']>, cpu: string, memory: Partial<DeviceScan['memory']>, battery: number): DeviceScan {
  return {
    ...base,
    identity: { ...base.identity, ...identity, system_family: null, system_sku: null },
    cpu: { ...base.cpu, name: cpu },
    memory: { ...base.memory, ...memory },
    storage: [{ media: 'ssd', bus: 'nvme', capacity_gb: 256, health: 'healthy' }],
    battery: { ...base.battery, health_percent: battery, full_charge_capacity_mwh: Math.round(base.battery.design_capacity_mwh! * battery / 100) },
  } as DeviceScan
}

export const MODELS: { name: string; scan: DeviceScan }[] = [
  {
    name: 'ThinkPad T480',
    scan: demoScan({ manufacturer: 'LENOVO', model: '20L5CTO1WW', product_version: 'ThinkPad T480' }, 'Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz', { total_gb: 8, type: 'ddr4', slots_total: 2, slots_used: 1 }, 64),
  },
  {
    name: 'XPS 13 9360',
    scan: demoScan({ manufacturer: 'Dell Inc.', model: 'XPS 13 9360', product_version: null }, 'Intel(R) Core(TM) i5-7200U CPU @ 2.50GHz', { total_gb: 8, type: 'lpddr3', slots_total: 0, slots_used: 0 }, 58),
  },
  {
    name: 'EliteBook 840 G5',
    scan: demoScan({ manufacturer: 'HP', model: 'HP EliteBook 840 G5', product_version: null }, 'Intel(R) Core(TM) i5-8350U CPU @ 1.70GHz', { total_gb: 8, type: 'ddr4', slots_total: 2, slots_used: 1 }, 70),
  },
]
