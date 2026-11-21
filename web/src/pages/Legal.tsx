import { Fragment, useLayoutEffect, useState } from 'react'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import { Link } from '../components/Link'
import { legalDoc, LEGAL_UI } from '../legal/content'
import type { Block, Lang, LegalKind } from '../legal/content'
import { PROVIDER } from '../legal/provider'

const LANGUAGES: { lang: Lang; label: string }[] = [
  { lang: 'de', label: 'Deutsch' },
  { lang: 'en', label: 'English' },
]

/** English unless the link says `?lang=de` (the switch on the page writes it into the address). */
function initialLang(): Lang {
  return new URLSearchParams(window.location.search).get('lang') === 'de' ? 'de' : 'en'
}

// Plain-text values in the legal texts become links (web addresses, the contact address) and values that are
// still in [square brackets] (see legal/provider.ts) are highlighted so that nobody publishes a gap by accident.
const INLINE = /(\[[^\]]+\]|https?:\/\/[^\s]+?(?=[.,;]?(?:\s|$))|contact@[\w-]+(?:\.[\w-]+)+)/g

export function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(INLINE).map((part, index) => {
        if (part.startsWith('[')) {
          return (
            <mark key={index} className="rounded bg-amber-tint px-1 font-semibold text-amber-ink">
              {part}
            </mark>
          )
        }
        const link = part.startsWith('http') ? part : part === PROVIDER.email ? `mailto:${part}` : null
        if (link) {
          return (
            <a key={index} href={link} className="font-semibold break-words text-leaf hover:text-leaf-dark">
              {part}
            </a>
          )
        }
        return <Fragment key={index}>{part}</Fragment>
      })}
    </>
  )
}

function Section({ block }: { block: Block }) {
  switch (block.type) {
    case 'h2':
      return <h2 className="m-0 mt-4 text-xl font-bold text-ink">{block.text}</h2>
    case 'ul':
      return (
        <ul className="m-0 list-disc space-y-1 pl-6 text-ink">
          {block.items.map((item) => (
            <li key={item}>
              <Inline text={item} />
            </li>
          ))}
        </ul>
      )
    default:
      // `whitespace-pre-line` keeps the line breaks of the postal address.
      return (
        <p className="m-0 leading-relaxed whitespace-pre-line text-ink">
          <Inline text={block.text} />
        </p>
      )
  }
}

/** Imprint and privacy notice (feature 006 FR-045). One component for both so the chosen language survives switching between them. */
export function LegalPage({ kind }: { kind: LegalKind }) {
  const [lang, setLang] = useState<Lang>(initialLang)
  const doc = legalDoc(kind, lang)
  const ui = LEGAL_UI[lang]
  const otherKind: LegalKind = kind === 'imprint' ? 'privacy' : 'imprint'

  // Opening the page from the footer must not keep the scroll position of the page before.
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [kind])

  const chooseLang = (next: Lang) => {
    setLang(next)
    window.history.replaceState(null, '', `${window.location.pathname}?lang=${next}`)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main lang={lang} className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-4 px-4 pt-6 pb-10 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/" className="text-sm font-semibold text-leaf hover:text-leaf-dark">
            ← {ui.back}
          </Link>
          <div role="group" aria-label={`${LEGAL_UI.de.language} / ${LEGAL_UI.en.language}`} className="inline-flex gap-1 rounded-full bg-track p-1">
            {LANGUAGES.map((option) => (
              <button
                key={option.lang}
                type="button"
                lang={option.lang}
                aria-pressed={lang === option.lang}
                onClick={() => chooseLang(option.lang)}
                className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  lang === option.lang ? 'bg-leaf text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <h1 className="m-0 text-3xl font-extrabold sm:text-4xl">{doc.title}</h1>
        <p className="m-0 text-sm text-muted">
          {ui.updated}: {doc.updated}
        </p>
        <div className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-card sm:p-8">
          {doc.blocks.map((block, index) => (
            <Section key={index} block={block} />
          ))}
        </div>
        <Link to={`/${otherKind}?lang=${lang}`} className="text-sm font-semibold text-leaf hover:text-leaf-dark">
          {ui.other[kind]} →
        </Link>
      </main>
      <Footer />
    </div>
  )
}
