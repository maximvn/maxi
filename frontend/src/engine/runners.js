import {computeRasterEngine,meetRasterPuur} from './poli.js'
import {fkBerekenAdvies} from './functiekamers.js'

// De rekenaars die de engine-client kent — identiek in de worker en in de
// synchrone terugval (zie client.js en engine.worker.js).
export const ENGINE_RUNNERS={
  poli: args=>computeRasterEngine(...args),
  functie: args=>fkBerekenAdvies(args[0]),
  meet: r=>meetRasterPuur(r),
}
