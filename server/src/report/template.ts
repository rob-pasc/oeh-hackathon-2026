import type { Path, Report } from '@leaaf/shared'
import type { DeviceAssessment } from '../assessment/service.ts'

const nextStep: Record<Path, string> = {
  upgrade: 'Confirm the compatible parts in the service manual before buying them.',
  repair: 'Ask a service provider to confirm the part and quote the repair.',
  pass_on: 'Back up and erase personal data before handing the device over.',
  salvage: 'Ask a refurbisher which components they can reuse.',
  recycle: 'Back up and erase personal data, then contact a certified electronics recycler.',
}

export function templateReport({ assessment, retrieval }: DeviceAssessment): Report {
  const sources = new Map(Object.values(retrieval.passages_by_path).flat().map(p => [p.passage_id, p]))
  const cited = new Set<string>()
  const paths = assessment.paths.map(({ path, status, reasons, impact }) => {
    const claims = reasons.filter(r => r.passage_ids.length && r.passage_ids.every(id => sources.has(id)))
      .map(({ text, passage_ids }) => ({ text, passage_ids }))
    for (const claim of claims) for (const id of claim.passage_ids) cited.add(id)
    return {
      path, claims, summary: reasons[0]!.text, why: reasons.map(r => r.text).join(' '),
      next_steps: [status === 'not_suitable' ? 'Consider one of the other paths for this device.' : nextStep[path]],
      assumptions: impact?.assumptions.map(a => a.text) ?? [],
      unverified: reasons.filter(r => r.code.startsWith('cannot_verify')).map(r => r.text),
      safety: path === 'repair' || path === 'upgrade' ? ['Follow the manufacturer’s service instructions before opening the device.'] : [],
    }
  })
  return {
    source: 'template', notice: 'AI explanation unavailable. These steps use the device assessment.',
    device_id: assessment.device_id, intended_use: assessment.intended_use, generated_at: assessment.created_at,
    paths, passages: [...sources.values()].filter(p => cited.has(p.passage_id)),
  }
}
