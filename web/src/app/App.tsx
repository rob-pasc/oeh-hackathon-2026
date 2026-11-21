import { DevicePage } from '../pages/DevicePage'
import { Landing } from '../pages/Landing'
import { LegalPage } from '../pages/Legal'
import { NotFound } from '../pages/NotFound'
import { ScanSession } from '../pages/ScanSession'
import { useRoute } from './router'

export function App() {
  const route = useRoute()
  switch (route.name) {
    case 'landing':
      return <Landing />
    case 'session':
      // `key` restarts the page state when the user opens another session or device.
      return <ScanSession key={route.id} sessionId={route.id} />
    case 'device':
      return <DevicePage key={route.id} deviceId={route.id} />
    case 'imprint':
    case 'privacy':
      return <LegalPage kind={route.name} />
    default:
      return <NotFound device={route.name === 'not_found' && route.device === true} />
  }
}
