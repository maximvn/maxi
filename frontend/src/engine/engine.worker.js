// De rekenengine als Web Worker (Vite bundelt dit bestand apart; App.jsx start hem
// met new Worker(new URL('./engine/engine.worker.js', import.meta.url), {type:'module'})).
// Hier draait alleen de rekenlus — geen React, geen DOM.
import {startEngineWorker} from './client.js'
import {ENGINE_RUNNERS} from './runners.js'
startEngineWorker(ENGINE_RUNNERS)
