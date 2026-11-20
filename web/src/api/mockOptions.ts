// FICTIONAL sample data for reviewing the path tabs in mock mode. It matches the fictional "Example Laptop 14"
// fixture and is NOT part of shared/. Real figures come from the server's calculator once it sends options
// (feature-006 DESIGN.md, "Proposed option payload").
import type { Impact } from '@leaaf/shared/assessment'
import type { Path, Suitability } from '@leaaf/shared/common'
import type { PathOption } from './types'

const BASELINE = { low: 200, high: 350 }

interface Figures {
  cost: [number, number]
  life: [number, number]
  /** Emissions caused by the action itself (new parts). */
  added: [number, number]
  /** Credited avoided CO₂e versus buying a new laptop. */
  avoided: [number, number]
  displacement?: Impact['displacement']
  assumption: string
}

function impact(f: Figures): Impact {
  return {
    cost_eur: { low: f.cost[0], high: f.cost[1] },
    useful_life_years: { low: f.life[0], high: f.life[1] },
    co2e_kg: {
      path: { low: f.added[0], high: f.added[1] },
      baseline: { ...BASELINE },
      avoided_vs_baseline: { low: f.avoided[0], high: f.avoided[1] },
    },
    displacement: f.displacement ?? 'assumed',
    assumptions: [{ text: f.assumption, impact_refs: [] }],
  }
}

function option(
  path: Path,
  option_id: string,
  title: string,
  status: Suitability,
  summary: string,
  figures: Figures | null,
  steps: string[],
  why: string | null,
  unverified: string[] = [],
): PathOption {
  return { option_id, path, title, status, summary, impact: figures ? impact(figures) : null, steps, why, unverified }
}

export const LAPTOP_OPTIONS: PathOption[] = [
  // Upgrade
  option(
    'upgrade',
    'ssd',
    'SSD upgrade',
    'viable',
    'Swap the old hard disk for a 500 GB NVMe SSD.',
    { cost: [40, 70], life: [1.5, 2.5], added: [5, 12], avoided: [110, 215], assumption: 'Sample price and production CO₂e of a 500 GB SSD.' },
    ['Buy a 500 GB M.2 2280 NVMe SSD.', 'Back up your data, then install the SSD and clone the old drive.'],
    'The old drive is a slow hard disk. An SSD makes the laptop feel new for office work.',
  ),
  option(
    'upgrade',
    'ram',
    'RAM upgrade',
    'viable',
    'Add an 8 GB DDR4 module to the free slot.',
    { cost: [20, 40], life: [0.5, 1], added: [3, 8], avoided: [40, 95], assumption: 'Sample price and production CO₂e of an 8 GB DDR4 module.' },
    ['Buy an 8 GB DDR4 SO-DIMM (2400 MT/s or faster).', 'Insert the module into the free slot.'],
    '8 GB gets tight with many browser tabs. A second module doubles it.',
  ),
  option(
    'upgrade',
    'cpu',
    'CPU upgrade',
    'not_suitable',
    'The processor is soldered to the board and cannot be replaced.',
    null,
    [],
    'A new processor would need a new mainboard, which costs more than it saves.',
  ),
  option(
    'upgrade',
    'gpu',
    'Graphics upgrade',
    'not_suitable',
    'The graphics are built into the processor, so there is nothing to swap.',
    null,
    [],
    'This laptop has no separate graphics card. Gaming performance stays limited.',
  ),

  // Repair
  option(
    'repair',
    'battery',
    'Battery replacement',
    'viable',
    'Swap the worn battery (72 % health).',
    { cost: [30, 50], life: [2, 3], added: [4, 9], avoided: [190, 340], assumption: 'Sample price and production CO₂e of a replacement battery.' },
    ['Order replacement battery EX-BAT-57.', 'Remove the two battery screws and swap the pack.'],
    'A fresh battery brings back all-day use and costs far less than a new laptop.',
  ),
  option(
    'repair',
    'cooling',
    'Fan cleaning and new thermal paste',
    'conditional',
    'Only worth it if the laptop runs hot or loud.',
    { cost: [0, 15], life: [0.5, 1], added: [0, 1], avoided: [30, 70], assumption: 'Sample cost of thermal paste; no parts replaced.' },
    ['Open the back cover.', 'Clean the fan and the heat sink.', 'Apply new thermal paste.'],
    'Dust and old paste make laptops hot and slow.',
    ['No model-specific disassembly guide found.'],
  ),

  // Pass on
  option(
    'pass_on',
    'friend',
    'Give it to someone you know',
    'viable',
    'A friend or relative keeps using it.',
    { cost: [0, 10], life: [2, 3], added: [0, 1], avoided: [0, 260], displacement: 'conditional', assumption: 'Credited only if the receiver would otherwise buy a new laptop.' },
    ['Reset the operating system and securely erase the drive.', 'Hand it over with the charger.'],
    'It is the quickest way to give the laptop a second life.',
  ),
  option(
    'pass_on',
    'reuse',
    'Donate to a reuse initiative',
    'conditional',
    'Schools and local projects often take working laptops.',
    { cost: [0, 5], life: [2, 3], added: [0, 1], avoided: [0, 200], displacement: 'conditional', assumption: 'Credited only if the receiver would otherwise buy a new laptop.' },
    ['Reset the operating system and securely erase the drive.', 'Offer it to a school, a student, or a local reuse initiative.'],
    'Initiatives reach people who need a laptop but cannot afford one.',
    ['Accepted models differ by initiative.'],
  ),

  // Salvage
  option(
    'salvage',
    'ram',
    'Reuse the RAM module',
    'conditional',
    'The 8 GB DDR4 module fits other devices of the same type.',
    { cost: [0, 0], life: [0, 0], added: [0, 0], avoided: [0, 0], displacement: 'none', assumption: 'No avoided production is credited for salvaged parts.' },
    ['Remove the RAM module.', 'Use it in another device that takes DDR4 SO-DIMMs.'],
    'Only useful if you own a compatible device.',
  ),
  option(
    'salvage',
    'drive',
    'Reuse the old hard drive',
    'not_suitable',
    'A hard disk of this age is too risky to reuse.',
    null,
    [],
    'Old hard disks fail often. Keep important data elsewhere.',
  ),

  // Recycle
  option(
    'recycle',
    'ewaste',
    'Certified e-waste collection',
    'viable',
    'Materials are recovered by a certified collector.',
    { cost: [0, 0], life: [0, 0], added: [0, 0], avoided: [0, 0], displacement: 'none', assumption: 'No avoided production is credited for recycling.' },
    ['Erase all data.', 'Bring it to a certified e-waste collection point.'],
    'This is the right end for a device that cannot be used any more.',
  ),
  option(
    'recycle',
    'takeback',
    'Manufacturer take-back',
    'conditional',
    'Only if the maker runs a take-back program.',
    { cost: [0, 0], life: [0, 0], added: [0, 0], avoided: [0, 0], displacement: 'none', assumption: 'No avoided production is credited for recycling.' },
    ['Check the maker’s website for a take-back program.', 'Erase all data, then send or drop off the laptop.'],
    null,
    ['Take-back programs differ by country.'],
  ),
]
