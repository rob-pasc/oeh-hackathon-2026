import type { Report, PathExplanation } from '@leaaf/shared/report'

export function ReportDetails({ explanation, passages }: { explanation: PathExplanation | undefined; passages: Report['passages'] }) {
  if (!explanation) return null
  const sources = new Map(passages.map(p => [p.passage_id, p]))
  return (
    <details className="col-span-full border-t border-line pt-3 text-sm">
      <summary className="cursor-pointer font-semibold text-leaf">Evidence, assumptions and safety</summary>
      <h4 className="mt-3 font-bold">Evidence</h4>
      {explanation.claims.length === 0 && <p>No cited passages for this path.</p>}
      {explanation.claims.map((claim, i) => (
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
      <h4 className="mt-3 font-bold">Assumptions</h4>
      {explanation.assumptions.length ? explanation.assumptions.map((t,i) => <p key={i}>{t}</p>) : <p>None listed.</p>}
      <h4 className="mt-3 font-bold">Safety and feasibility</h4>
      {explanation.safety.length ? explanation.safety.map((t,i) => <p key={i}>{t}</p>) : <p>No additional notes.</p>}
    </details>
  )
}
