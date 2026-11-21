// Which scanner to offer (feature 007 FR-013, FR-014): the visitor's system, its download name,
// how to run the scanner there, and what that scanner reads.
import type { OsFamily } from '@leaaf/shared/common'

export interface PlatformInfo {
  os: OsFamily
  label: string
  /** File name the browser saves the download as. */
  filename: string
  /** How to start the scanner, in order. */
  steps: readonly string[]
  /** What the scanner reads and asks for. */
  reads: string
  /** Where the scan is saved before upload. */
  saves: string
}

export const PLATFORMS: Record<OsFamily, PlatformInfo> = {
  windows: {
    os: 'windows',
    label: 'Windows',
    filename: 'leaaf-scanner.exe',
    steps: [
      'Open the downloaded leaaf-scanner.exe.',
      'If Windows SmartScreen warns you, choose More info, then Run anyway.',
      'Allow administrator access, then press Start scan.',
    ],
    reads:
      'Windows asks for administrator access because the scanner needs it to read battery and firmware data. When you press Start scan, leaaf reads your device model, processor, graphics, memory, internal drives, battery health, Windows version, and firmware settings including TPM and Secure Boot.',
    saves: 'It saves the scan next to the scanner',
  },
  macos: {
    os: 'macos',
    label: 'Mac',
    filename: 'leaaf-scanner-macos.zip',
    steps: [
      'Open the download. Safari unzips it for you; otherwise double-click the zip file.',
      'Open the leaaf scanner app. macOS says it cannot check the app, because it is not from the App Store.',
      'Open System Settings, then Privacy & Security, and click Open Anyway. Then press Start scan.',
    ],
    reads:
      'No password is needed. When you press Start scan, leaaf reads your Mac’s model, chip, graphics, memory, internal drives, battery health, and macOS version with the Mac’s own system tools. Macs from before about 2015 cannot run the scanner, because it needs macOS 12 or later.',
    saves: 'It saves the scan in your home folder',
  },
  linux: {
    os: 'linux',
    label: 'Linux',
    filename: 'leaaf-scanner',
    steps: [
      'Allow the file to run: in your file manager open its properties and allow executing it, or run chmod +x leaaf-scanner in a terminal.',
      'Open it from your desktop session (X11 or Wayland), then press Start scan.',
      'Your system asks for your password once. You can cancel and still scan.',
    ],
    reads:
      'When you press Start scan, leaaf reads your device model, processor, graphics, memory, internal drives, battery health, Linux distribution, and firmware settings including TPM and Secure Boot. Your password lets it also read memory type and slots and drive health.',
    saves: 'It saves the scan next to the scanner',
  },
}

export const PLATFORM_ORDER: readonly OsFamily[] = ['windows', 'macos', 'linux']

interface NavigatorLike {
  userAgent: string
  maxTouchPoints?: number
  userAgentData?: { platform?: string }
}

/**
 * The visitor's desktop system, or null when it is not one the scanner runs on (phones,
 * tablets, Chromebooks) or cannot be told. iPads ask for desktop sites as "Macintosh", so a
 * touch screen on a "Mac" counts as unknown.
 */
export function detectOs(nav: NavigatorLike): OsFamily | null {
  const ua = nav.userAgent
  const platform = nav.userAgentData?.platform?.toLowerCase() ?? ''
  if (platform === 'windows') return 'windows'
  if (platform === 'macos') return 'macos'
  if (platform === 'linux') return 'linux'
  if (platform) return null // Android, Chrome OS, iOS and others
  if (/Android|CrOS|iPhone|iPad|iPod/.test(ua)) return null
  if (/Windows NT/.test(ua)) return 'windows'
  if (/Macintosh|Mac OS X/.test(ua)) return (nav.maxTouchPoints ?? 0) > 1 ? null : 'macos'
  if (/Linux|X11/.test(ua)) return 'linux'
  return null
}
