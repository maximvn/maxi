// Ingang voor de referentiebundel: alles wat de pariteitstest uit de JavaScript-rekenkern nodig heeft.
// De bron is rechtstreeks de rekenkern van de frontend; er komt geen React of interface mee in de bundel.
export * as E from '../../../src2/engine.js'
export { voerJobUit } from '../../../src2/jobs.js'
export { zetIdMaker, tellerIds } from '../../../src2/util.js'
export { emptyState, VOORBEELD_INVOERLIJST_1, VOORBEELD_VERRIJKING, VOORBEELD_PLANGROEPEN, VOORBEELD_VERRICHTINGEN } from '../../../src2/data.js'
export { applyInvoerlijst1, applyInvoerlijst2 } from '../../../src2/importers.js'
