// The Imprint and the Privacy notice in German and English. Facts about the processing come from the
// backend (docs/DEPLOYMENT.md, docs/adr/adr-002, feature 001 privacy allowlist); the people and numbers
// come from provider.ts. Keep this file in step with the backend: if what the server stores or sends
// changes, the text must change in the same commit.
//
// Texts must not contain square brackets: the page highlights [bracketed] values as "still to fill in".
import { PROVIDER } from './provider'

export type Lang = 'de' | 'en'
export type Block =
  | { type: 'h2'; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: readonly string[] }
export type LegalDoc = { title: string; blocks: Block[]; updated: string }
export type LegalKind = 'imprint' | 'privacy'

const MONTHS: Record<Lang, readonly string[]> = {
  de: ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}

function formatDate(iso: string, lang: Lang): string {
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number]
  const name = MONTHS[lang][month - 1]
  return lang === 'de' ? `${day}. ${name} ${year}` : `${day} ${name} ${year}`
}

export const LEGAL_UI = {
  de: {
    language: 'Sprache',
    back: 'Zur Startseite',
    updated: 'Stand',
    other: { imprint: 'Zur Datenschutzerklärung', privacy: 'Zum Impressum' },
  },
  en: {
    language: 'Language',
    back: 'Back to home',
    updated: 'Last updated',
    other: { imprint: 'Go to the privacy notice', privacy: 'Go to the imprint' },
  },
} as const

const addressLines = (lang: Lang) => [...PROVIDER.address, PROVIDER.country[lang]].join('\n')

function imprintDe(): Block[] {
  return [
    { type: 'h2', text: 'Medieninhaber und Diensteanbieter' },
    { type: 'p', text: PROVIDER.name },
    { type: 'p', text: `Anschrift (für Zustellungen):\n${addressLines('de')}` },
    { type: 'p', text: `E-Mail: ${PROVIDER.email}` },
    { type: 'h2', text: 'Art und Zweck des Angebots' },
    {
      type: 'p',
      text: 'Nicht gewinnorientiertes Hochschul- und Hackathon-Projekt (ÖH Hackathon 2026, „AI for Green“). leaaf.green ist kostenlos, enthält keine Werbung und verkauft nichts.',
    },
    { type: 'h2', text: 'Grundlegende Richtung' },
    {
      type: 'p',
      text: 'Information darüber, wie sich ein gebrauchter Windows-Laptop oder -PC weiterverwenden lässt (aufrüsten, reparieren, weitergeben, Teile verwerten oder recyceln), auf Grundlage der Hardware-Daten des gescannten Geräts.',
    },
    { type: 'h2', text: 'Offenlegung und Rechtsgrundlagen' },
    {
      type: 'p',
      text: 'Diese Angaben erfolgen gemäß § 25 Mediengesetz und freiwillig im Sinn des § 5 E-Commerce-Gesetz.',
    },
    { type: 'h2', text: 'Keine Gewähr für Empfehlungen' },
    {
      type: 'p',
      text: 'Die Empfehlungen von leaaf.green sind automatisch erstellte Orientierungshilfen. Sie beruhen auf den Daten des Scans, auf Annahmen und Schätzungen und teilweise auf KI-gestützten Texten. Preise, CO₂-Werte und Lebensdauer sind Schätzungen. Wir übernehmen keine Gewähr für Richtigkeit und Vollständigkeit. Reparaturen und Eingriffe in die Hardware erfolgen auf eigene Verantwortung; lass dich bei Unsicherheit von einer Fachperson beraten.',
    },
    { type: 'h2', text: 'Haftung für Links' },
    {
      type: 'p',
      text: 'Unsere Seiten können Links zu externen Websites enthalten, auf deren Inhalte wir keinen Einfluss haben. Für diese Inhalte ist stets der jeweilige Betreiber verantwortlich. Bei Bekanntwerden von Rechtsverletzungen entfernen wir solche Links umgehend.',
    },
    { type: 'h2', text: 'Urheberrecht und Lizenzen' },
    {
      type: 'p',
      text: 'Die Inhalte dieser Website sind urheberrechtlich geschützt. Die Schrift „Inter“ (© The Inter Project Authors) wird unter der SIL Open Font License 1.1 verwendet.',
    },
  ]
}

function imprintEn(): Block[] {
  return [
    { type: 'h2', text: 'Media owner and service provider' },
    { type: 'p', text: PROVIDER.name },
    { type: 'p', text: `Postal address (for official service of documents):\n${addressLines('en')}` },
    { type: 'p', text: `Email: ${PROVIDER.email}` },
    { type: 'h2', text: 'Nature and purpose of the service' },
    {
      type: 'p',
      text: 'A non-profit university and hackathon project (ÖH Hackathon 2026, "AI for Green"). leaaf.green is free, shows no advertising and sells nothing.',
    },
    { type: 'h2', text: 'Editorial line' },
    {
      type: 'p',
      text: 'Information on how a used Windows laptop or PC can stay in use (upgrade, repair, pass on, salvage parts or recycle), based on the hardware data of the scanned device.',
    },
    { type: 'h2', text: 'Disclosure and legal basis' },
    {
      type: 'p',
      text: 'These details are given under section 25 of the Austrian Media Act (Mediengesetz) and voluntarily in line with section 5 of the Austrian E-Commerce Act.',
    },
    { type: 'h2', text: 'No guarantee for recommendations' },
    {
      type: 'p',
      text: 'The recommendations on leaaf.green are automatically generated guidance. They rest on the scan data, on assumptions and estimates, and partly on AI-assisted text. Prices, CO₂ figures and expected lifetimes are estimates. We give no guarantee that they are correct or complete. Repairs and work on the hardware are at your own risk; ask a professional if you are unsure.',
    },
    { type: 'h2', text: 'Liability for links' },
    {
      type: 'p',
      text: 'Our pages may link to external websites whose content we cannot influence. The respective operator is always responsible for that content. If we learn of an infringement, we remove such links promptly.',
    },
    { type: 'h2', text: 'Copyright and licences' },
    {
      type: 'p',
      text: 'The content of this website is protected by copyright. The typeface "Inter" (© The Inter Project Authors) is used under the SIL Open Font License 1.1.',
    },
  ]
}

const DSB = 'Österreichische Datenschutzbehörde, Barichgasse 40–42, 1030 Wien, dsb@dsb.gv.at, www.dsb.gv.at'
const DEEPSEEK_POLICY = 'https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html'
const LANGSEARCH = 'LangSearch (langsearch.com)'
const TINYFISH = 'TinyFish (tinyfish.ai)'
const NOMINATIM = 'Nominatim (nominatim.openstreetmap.org), betrieben von der OpenStreetMap Foundation, Vereinigtes Königreich'
const NOMINATIM_EN = 'Nominatim (nominatim.openstreetmap.org), run by the OpenStreetMap Foundation, United Kingdom'

function privacyDe(): Block[] {
  return [
    {
      type: 'p',
      text: 'Kurzfassung: leaaf.green braucht kein Konto, setzt dir keine Cookies, verwendet kein Tracking und zeigt keine Werbung. Gespeichert werden technische Hardware-Daten deines Geräts, aber keine Namen, E-Mail-Adressen oder Seriennummern.',
    },
    { type: 'h2', text: '1. Verantwortliche und Kontakt' },
    {
      type: 'p',
      text: `Verantwortlich im Sinn der DSGVO ist die im Impressum genannte Person. Kontakt für alle Fragen zum Datenschutz: ${PROVIDER.email}. Eine Datenschutzbeauftragte oder ein Datenschutzbeauftragter ist nicht bestellt.`,
    },
    { type: 'h2', text: '2. Hosting und Server-Logdateien' },
    {
      type: 'p',
      text: `leaaf.green läuft auf einem Server in Vorarlberg, Österreich, den ${PROVIDER.serverOperator}, Mitglied unseres Projektteams, in unserem Auftrag betreibt. Bei jedem Aufruf verarbeitet der Webserver technisch notwendige Daten: deine IP-Adresse, Datum und Uhrzeit, die angeforderte Adresse (URL-Pfad), den HTTP-Status, die übertragene Datenmenge und die Browser-Kennung (User-Agent).`,
    },
    {
      type: 'p',
      text: `Zweck: sicherer und stabiler Betrieb, Fehlersuche und Schutz vor Missbrauch. Rechtsgrundlage: berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO). Die Logdateien werden nach ${PROVIDER.logRetentionDays} Tagen gelöscht. Zusätzlich zählt der Server Anfragen pro IP-Adresse kurzzeitig im Arbeitsspeicher, um Überlastung zu verhindern; diese Zähler werden nicht dauerhaft gespeichert.`,
    },
    { type: 'h2', text: '3. Scan deines Geräts' },
    {
      type: 'p',
      text: 'Wenn du „Download and Scan now“ wählst, lädst du ein kleines Programm (den Scanner) herunter und führst es auf deinem Windows-Gerät aus. Der Scanner liest nur diese Angaben: Modell, Prozessor, Grafikkarte, Arbeitsspeicher, Speicher, Akkuzustand, Windows-Version, Firmware-, TPM- und Secure-Boot-Status. Er liest keine Seriennummern, keine UUIDs, keine Computer- oder Benutzernamen, keine Netzwerkkennungen und keine Dateien.',
    },
    {
      type: 'p',
      text: `Die Angaben werden verschlüsselt (HTTPS) an unseren Server gesendet und in einer Datenbank auf dem Server gespeichert. Der Server vergibt zufällige Kennungen für die Sitzung und das Gerät. Die Ergebnisseite ist nur über ihren Link erreichbar: Wer den Link kennt, kann das Ergebnis sehen. Gib den Link daher nur weiter, wenn du das möchtest. Wir löschen Scan-Daten nach ${PROVIDER.scanRetentionDays} Tagen.`,
    },
    {
      type: 'p',
      text: 'Zweck: dir eine Empfehlung für dein Gerät zu berechnen und anzuzeigen. Rechtsgrundlage: berechtigtes Interesse am Betrieb des von dir gewünschten Dienstes (Art. 6 Abs. 1 lit. f DSGVO). Die Daten sind keiner Person zugeordnet; wir können dich anhand dieser Daten nicht identifizieren, es sei denn, du nennst uns den Link zu deinem Ergebnis (Art. 11 DSGVO).',
    },
    { type: 'h2', text: '4. KI-Dienst (DeepSeek) und Websuche' },
    {
      type: 'p',
      text: 'Für Erklärungstexte und die Schätzung einzelner Bauteile senden wir technische Angaben an die Programmierschnittstelle (API) des KI-Dienstes DeepSeek, betrieben von Hangzhou DeepSeek Artificial Intelligence Co., Ltd., China. Übermittelt werden Hardware-Beschreibungen und Auszüge aus öffentlicher Dokumentation. Nicht übermittelt werden deine IP-Adresse, die Kennungen von Sitzung oder Gerät, Namen oder andere Angaben, die auf dich verweisen.',
    },
    {
      type: 'p',
      text: `Wir gehen davon aus, dass es sich dabei nicht um personenbezogene Daten handelt, weil sie keiner Person zugeordnet werden können. DeepSeek verarbeitet Daten nach eigenen Angaben in der Volksrepublik China, für die kein Angemessenheitsbeschluss der EU besteht. Näheres steht in der Datenschutzerklärung von DeepSeek: ${DEEPSEEK_POLICY}. Die Empfehlung selbst wird nach festen Regeln berechnet; es gibt keine automatisierte Entscheidung mit rechtlicher Wirkung für dich (Art. 22 DSGVO).`,
    },
    {
      type: 'p',
      text: `Fehlt in unserer eigenen Dokumentensammlung etwas zu deinem Gerätemodell, suchen wir öffentliche Webseiten dazu, über die Suchdienste ${LANGSEARCH} und, falls dieser nicht antwortet, ${TINYFISH}. An diese Dienste senden wir nur den Hersteller, die Modellbezeichnung und ein Thema (zum Beispiel „Arbeitsspeicher“). Andere Scan-Daten, die Kennungen von Sitzung oder Gerät und deine IP-Adresse senden wir nicht. Diese Angaben sind keiner Person zugeordnet. Die gefundenen Seiten speichern wir 30 Tage lang pro Gerätemodell, nicht pro Gerät, und zeigen sie im Ergebnis als „Web source“ mit Link an.`,
    },
    {
      type: 'p',
      text: 'Über dieselben Suchdienste suchen wir außerdem aktuelle Preise für SSD, Arbeitsspeicher und Akku auf Preisvergleichsseiten sowie Reparatur-, Spende- und Sammelstellen. Dafür senden wir nur die Bauteilbezeichnung (zum Beispiel „500 GB M.2 NVMe SSD“, beim Akku Hersteller und Modell) oder die Art der Stelle zusammen mit „Österreich“ oder dem Ort, den du freiwillig teilst (Abschnitt 5). Die gefundenen Preise und Stellen speichern wir 7 Tage lang pro Bauteil und pro Ort, nicht pro Gerät, und zeigen sie als „Web price“ und „Web source · check“ mit Link an.',
    },
    { type: 'h2', text: '5. Standort teilen (freiwillig)' },
    {
      type: 'p',
      text: `Auf der Ergebnisseite kannst du mit „Share location“ deinen Standort teilen, damit wir Stellen in deiner Nähe suchen. Das ist freiwillig: Ohne Standort zeigen wir Stellen in ganz Österreich. Dein Browser fragt dich vorher um Erlaubnis und sendet die Koordinaten auf zwei Nachkommastellen gerundet (auf etwa 1 km genau) an unseren Server. Der Server sendet diese gerundeten Koordinaten an den Dienst ${NOMINATIM}, der daraus den Namen deines Orts ermittelt. Nominatim erhält dabei nicht deine IP-Adresse, sondern die unseres Servers.`,
    },
    {
      type: 'p',
      text: `Die Koordinaten speichern wir nicht und schreiben sie in keine Logdatei; sie liegen nur kurz im Arbeitsspeicher des Servers. Gespeichert wird nur der Ortsname, und nur für den Link dieses Ergebnisses. Wir löschen ihn mit den Scan-Daten nach ${PROVIDER.scanRetentionDays} Tagen oder sofort, wenn du „Austria-wide“ wählst. An die Suchdienste geht nur der Ortsname, nie Koordinaten. Rechtsgrundlage: deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die du durch das Teilen gibst und jederzeit mit „Austria-wide“ widerrufen kannst. Ortsnamen: © OpenStreetMap contributors (ODbL).`,
    },
    { type: 'h2', text: '6. Cookies und Speicher im Browser' },
    {
      type: 'p',
      text: 'Wir setzen keine Cookies und verwenden keine Analyse-, Werbe- oder Social-Media-Dienste. Nur wenn du die Laptop-Ansicht der Ergebnisse ein- oder ausschaltest, merkt sich dein Browser diese Einstellung lokal (Eintrag „leaaf.showLaptopView“ im lokalen Speicher). Der Eintrag verlässt dein Gerät nicht, ist für die von dir gewünschte Einstellung technisch erforderlich (§ 165 Abs. 3 TKG 2021) und kann jederzeit in den Browser-Einstellungen gelöscht werden.',
    },
    {
      type: 'p',
      text: 'Die einzige Ausnahme ist der Verwaltungsbereich unter /admin, der nur für unser Projektteam gedacht ist: Nach der Anmeldung setzt er ein technisch notwendiges Sitzungs-Cookie („leaaf_admin“), das nur an die Verwaltungsschnittstelle gesendet wird und nach spätestens 12 Stunden oder beim Abmelden abläuft. Besucherinnen und Besucher, die sich dort nicht anmelden, erhalten kein Cookie.',
    },
    { type: 'h2', text: '7. Schrift' },
    {
      type: 'p',
      text: 'Die Schrift Inter liegt auf unserem eigenen Server. Deshalb nimmt dein Browser keine Verbindung zu Google Fonts oder anderen Schriftanbietern auf.',
    },
    { type: 'h2', text: '8. Empfänger' },
    {
      type: 'p',
      text: 'Wir geben deine Daten nicht an Dritte weiter und verkaufen sie nicht. Die einzigen Ausnahmen sind der KI-Dienst und die Suchdienste nach Abschnitt 4 und, wenn du deinen Standort teilst, Nominatim nach Abschnitt 5, jeweils mit den dort genannten Angaben. Behörden erhalten Daten nur, wenn eine gesetzliche Pflicht dazu besteht.',
    },
    { type: 'h2', text: '9. Deine Rechte' },
    {
      type: 'p',
      text: 'Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21 DSGVO). Schreib uns dazu an die oben genannte E-Mail-Adresse und nenne den Link zu deinem Ergebnis, damit wir deine Daten finden. Ohne diesen Link können wir Scan-Daten nicht zuordnen.',
    },
    {
      type: 'p',
      text: `Wenn du glaubst, dass wir Daten rechtswidrig verarbeiten, kannst du dich bei der Aufsichtsbehörde beschweren: ${DSB}.`,
    },
    { type: 'h2', text: '10. Änderungen' },
    {
      type: 'p',
      text: 'Wenn sich ändert, was leaaf.green speichert oder sendet, passen wir diese Erklärung an. Das Datum der letzten Änderung steht oben.',
    },
  ]
}

function privacyEn(): Block[] {
  return [
    {
      type: 'p',
      text: 'In short: leaaf.green needs no account, sets no cookies for you, uses no tracking and shows no advertising. We store technical hardware data of your device, but no names, email addresses or serial numbers.',
    },
    { type: 'h2', text: '1. Controller and contact' },
    {
      type: 'p',
      text: `The person named in the imprint is the controller under the GDPR. Contact for all data protection questions: ${PROVIDER.email}. No data protection officer has been appointed.`,
    },
    { type: 'h2', text: '2. Hosting and server log files' },
    {
      type: 'p',
      text: `leaaf.green runs on a server in Vorarlberg, Austria, operated on our behalf by ${PROVIDER.serverOperator}, a member of our project team. Each time you open a page, the web server processes technically necessary data: your IP address, date and time, the requested address (URL path), the HTTP status, the amount of data sent and your browser identifier (user agent).`,
    },
    {
      type: 'p',
      text: `Purpose: secure and stable operation, troubleshooting and protection against abuse. Legal basis: legitimate interest (Art. 6(1)(f) GDPR). Log files are deleted after ${PROVIDER.logRetentionDays} days. The server also counts requests per IP address for a short time in memory to prevent overload; these counters are not stored permanently.`,
    },
    { type: 'h2', text: '3. Scan of your device' },
    {
      type: 'p',
      text: 'When you choose "Download and Scan now", you download a small program (the scanner) and run it on your Windows device. The scanner reads only these details: model, processor, graphics card, memory, storage, battery condition, Windows version, firmware, TPM and Secure Boot status. It does not read serial numbers, UUIDs, computer or user names, network identifiers or files.',
    },
    {
      type: 'p',
      text: `The details are sent encrypted (HTTPS) to our server and stored in a database on that server. The server assigns random identifiers for the session and the device. The results page can only be reached through its link: anyone who knows the link can see the result, so share it only if you want to. We delete scan data after ${PROVIDER.scanRetentionDays} days.`,
    },
    {
      type: 'p',
      text: 'Purpose: to calculate and show you a recommendation for your device. Legal basis: legitimate interest in running the service you asked for (Art. 6(1)(f) GDPR). The data is not linked to a person; we cannot identify you from it unless you give us the link to your result (Art. 11 GDPR).',
    },
    { type: 'h2', text: '4. AI service (DeepSeek) and web search' },
    {
      type: 'p',
      text: 'For explanatory text and the estimate of individual components, we send technical details to the programming interface (API) of the AI service DeepSeek, operated by Hangzhou DeepSeek Artificial Intelligence Co., Ltd., China. We send hardware descriptions and excerpts from public documentation. We do not send your IP address, the identifiers of the session or device, names or any other detail that points to you.',
    },
    {
      type: 'p',
      text: `We assume this is not personal data because it cannot be linked to a person. According to its own statements, DeepSeek processes data in the People's Republic of China, for which the EU has no adequacy decision. Details are in DeepSeek's privacy policy: ${DEEPSEEK_POLICY}. The recommendation itself is calculated by fixed rules; there is no automated decision with legal effect for you (Art. 22 GDPR).`,
    },
    {
      type: 'p',
      text: `When our own document collection has nothing on your device model, we search public web pages for it, using the search services ${LANGSEARCH} and, if it does not answer, ${TINYFISH}. We send these services only the manufacturer, the model name and a topic (for example "memory"). We send no other scan data, no session or device identifiers and not your IP address. These details are not linked to a person. We keep the pages found for 30 days per device model, not per device, and show them in the result as "Web source" with a link.`,
    },
    {
      type: 'p',
      text: 'Through the same search services we also look up current prices for SSDs, memory and batteries on price comparison sites, and places that repair, take donations or collect old devices. For this we send only the part name (for example "500 GB M.2 NVMe SSD", or the manufacturer and model for a battery), or the kind of place together with "Austria" or the town you choose to share (section 5). We keep the prices and places found for 7 days per part and per town, not per device, and show them as "Web price" and "Web source · check" with a link.',
    },
    { type: 'h2', text: '5. Sharing your location (optional)' },
    {
      type: 'p',
      text: `On the results page you can share your location with "Share location" so that we search for places near you. This is optional: without a location we show places across Austria. Your browser asks for your permission first and sends the coordinates rounded to two decimals (to about 1 km) to our server. The server sends these rounded coordinates to the service ${NOMINATIM_EN}, which returns the name of your town. Nominatim receives our server's IP address, not yours.`,
    },
    {
      type: 'p',
      text: `We do not store the coordinates and do not write them to any log file; they are held briefly in the server's memory only. We store only the town name, and only for the link of this result. We delete it with the scan data after ${PROVIDER.scanRetentionDays} days, or at once when you choose "Austria-wide". The search services receive only the town name, never coordinates. Legal basis: your consent (Art. 6(1)(a) GDPR), which you give by sharing and can withdraw at any time with "Austria-wide". Town names: © OpenStreetMap contributors (ODbL).`,
    },
    { type: 'h2', text: '6. Cookies and browser storage' },
    {
      type: 'p',
      text: 'We set no cookies and use no analytics, advertising or social media services. Only when you switch the laptop view of the results on or off does your browser remember that setting locally (the entry "leaaf.showLaptopView" in local storage). The entry never leaves your device, is technically necessary for the setting you asked for (section 165(3) of the Austrian Telecommunications Act 2021) and can be deleted in your browser settings at any time.',
    },
    {
      type: 'p',
      text: 'The only exception is the admin area at /admin, which is meant for our project team only: after login it sets a strictly necessary session cookie ("leaaf_admin") that is sent only to the admin interface and expires after 12 hours at the latest or on logout. Visitors who do not log in there receive no cookie.',
    },
    { type: 'h2', text: '7. Typeface' },
    {
      type: 'p',
      text: 'The typeface Inter is stored on our own server. Your browser therefore makes no connection to Google Fonts or any other font provider.',
    },
    { type: 'h2', text: '8. Recipients' },
    {
      type: 'p',
      text: 'We do not pass your data on to third parties and we do not sell it. The only exceptions are the AI service and the search services in section 4 and, if you share your location, Nominatim in section 5, each with the details listed there. Authorities receive data only where the law requires it.',
    },
    { type: 'h2', text: '9. Your rights' },
    {
      type: 'p',
      text: 'You have the right of access (Art. 15), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18), data portability (Art. 20) and objection (Art. 21 GDPR). Write to the email address above and include the link to your result so that we can find your data. Without that link we cannot match scan data to you.',
    },
    {
      type: 'p',
      text: `If you believe we process data unlawfully, you can complain to the supervisory authority: ${DSB}.`,
    },
    { type: 'h2', text: '10. Changes' },
    {
      type: 'p',
      text: 'If what leaaf.green stores or sends changes, we update this notice. The date of the last change is shown at the top.',
    },
  ]
}

export function legalDoc(kind: LegalKind, lang: Lang): LegalDoc {
  const updated = formatDate(PROVIDER.lastUpdated, lang)
  if (kind === 'imprint') {
    return { title: lang === 'de' ? 'Impressum' : 'Imprint', blocks: lang === 'de' ? imprintDe() : imprintEn(), updated }
  }
  return {
    title: lang === 'de' ? 'Datenschutzerklärung' : 'Privacy notice',
    blocks: lang === 'de' ? privacyDe() : privacyEn(),
    updated,
  }
}
