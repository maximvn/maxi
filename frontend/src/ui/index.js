/**
 * ═══ UI — alle bouwstenen via één importpad ══════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Verzamelt de bouwstenen uit ui/, zodat een scherm schrijft:
 *   `import { Btn, Modal, useToast } from '../../ui/index.js'`.
 *
 * Plaats in de tool
 *   Tussen de bouwstenen (Icon, invoer, basis, Modal, meldingen, slepen) en de schermen.
 *
 * Invoer
 *   —
 * Uitvoer
 *   Alle publieke componenten en hooks uit ui/.
 *
 * Hoe het werkt
 *   1. Alleen doorverwijzingen (export … from); geen eigen code.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "does not provide an export named …": de bouwsteen staat in een ander bestand; zoek met
 *     `grep -rn "export const Naam" frontend/src/ui`.
 */
export { Icon } from './Icon.jsx'
export { Btn, IconBtn, Field, Input, TimeInput, Num, Seg, Switch, Dropzone } from './invoer.jsx'
export { Chip, Banner, Empty, Ring, Bar, Kpi } from './basis.jsx'
export { Modal } from './Modal.jsx'
export { useToast, ToastProvider, useConfirm, ConfirmProvider } from './meldingen.jsx'
export { useDrag, DragProvider } from './slepen.jsx'
