import type { Report, PathExplanation } from '@leaaf/shared/report'

/** Evidence, assumptions and safety notes of a path. Sections without content are left out; with none, nothing shows. */
export function ReportDetails({ explanation, passages }: { explanation: PathExplanation | undefined; passages: Report['passages'] }) {
  if (!explanation) return null
  const { claims, assumptions, safety } = explanation
  if (claims.length === 0 && assumptions.length === 0 && safety.length === 0) return null
  const sources = new Map(passages.map(p => [p.passage_id, p]))
  return (
    <details className="col-span-full border-t border-line pt-3 text-sm">
      <summary className="cursor-pointer font-semibold text-leaf">Evidence, assumptions and safety</summary>
      {claims.length > 0 && <h4 className="mt-3 font-bold">Evidence</h4>}
      {claims.map((claim, i) => (
        <div key={i} className="mt-2">
          <p>{claim.text}</p>
          {claim.passage_ids.map(id => {
            const p = sources.get(id)
            if (!p) return null
            return <blockquote key={id} className="mt-1 border-l-2 border-line pl-3 text-muted">
              <a className="font-medium text-leaf underline" target="_blank" rel="noreferrer" href={p.url}>
                {p.title}{p.section && ` · ${p.section}`}{p.page !== null && ` · p. ${p.page}`}
              </a>
              <p>{p.text}</p>
            </blockquote>
          })}
        </div>
      ))}
      {assumptions.length > 0 && <h4 className="mt-3 font-bold">Assumptions</h4>}
      {assumptions.map((t, i) => <p key={i}>{t}</p>)}
      {safety.length > 0 && <h4 className="mt-3 font-bold">Safety and feasibility</h4>}
      {safety.map((t, i) => <p key={i}>{t}</p>)}
    </details>
  )
}
