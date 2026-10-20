import {notesComponent} from './notes.mjs';
import {referencesComponent} from './references.mjs';

// Registrations are composed independently of the release descriptor list.
export function createMotePlugin() {
  return {components: [referencesComponent, notesComponent], async close() {}};
}
