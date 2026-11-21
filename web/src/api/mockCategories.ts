// FICTIONAL sample categories for mock mode (feature 008 FR-015). The laptop uses the shared fixture,
// which the server builds from a sample AI answer; the desktop shows the five-path fallback, built
// here the way the server builds it (server/src/categories/fallback.ts).
import type { Assessment } from '@leaaf/shared/assessment'
import type { CategoryResult, OptionKind } from '@leaaf/shared/categories'
import type { Path } from '@leaaf/shared/common'
import laptopCategoriesJson from '@leaaf/fixtures/categories.example-laptop-14.office.json'
import { PATH_TITLES } from '../lib/labels'

export const LAPTOP_CATEGORIES = laptopCategoriesJson as unknown as CategoryResult

const KIND: Record<Path, OptionKind> = { upgrade: 'other', repair: 'battery', pass_on: 'hand_down', salvage: 'salvage', recycle: 'recycle' }

export function fallbackCategories(assessment: Assessment): CategoryResult {
  return {
    device_id: assessment.device_id,
    intended_use: assessment.intended_use,
    generated_at: assessment.created_at,
    source: 'template',
    notice: 'AI explanation unavailable. These options use the device assessment.',
    passages: [],
    categories: assessment.paths.map((p) => {
      const fitting = p.status !== 'not_suitable' && p.impact !== null && p.scores !== null
      const reason = p.reasons[0]?.text ?? 'No details available.'
      return {
        category_id: p.path,
        label: PATH_TITLES[p.path],
        summary: reason,
        options: [
          {
            option_id: p.path,
            title: PATH_TITLES[p.path],
            status: p.status,
            reason,
            kind: KIND[p.path],
            difficulty: p.path === 'pass_on' || p.path === 'recycle' ? 'diy_easy' : 'diy_moderate',
            why: p.reasons.map((r) => r.text).join(' '),
            claims: [],
            impact: fitting ? p.impact : null,
            impact_source: fitting ? 'calculator' : null,
            scores: fitting ? p.scores : null,
            confidence: p.confidence,
            path: p.path,
          },
        ],
      }
    }),
  }
}
