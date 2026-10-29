// Ingang voor de referentiebundel: alles wat de pariteitstest uit de JavaScript-rekenkern nodig heeft.
// De bron is rechtstreeks de rekenkern van de frontend; er komt geen React of interface mee in de bundel.
export * as E from '../../../frontend/src/engine/index.js'
export { voerJobUit } from '../../../frontend/src/engine/jobs.js'
export { zetIdMaker, tellerIds } from '../../../frontend/src/lib/util.js'
export { emptyState, VOORBEELD_INVOERLIJST_1, VOORBEELD_VERRIJKING, VOORBEELD_PLANGROEPEN, VOORBEELD_VERRICHTINGEN } from '../../../frontend/src/lib/data.js'
export { applyInvoerlijst1, applyInvoerlijst2 } from '../../../frontend/src/lib/importers.js'
