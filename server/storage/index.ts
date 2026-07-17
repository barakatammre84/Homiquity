// The storage layer — split from the old 5,700-line server/storage.ts.
//
// Each ./<domain>.ts holds one domain's methods. TypeScript has no partial
// classes, so the domain classes form a LINEAR INHERITANCE CHAIN (users →
// applications → … → leads → DatabaseStorage); the chain order is meaningless
// except that a `this.x()` cross-domain call needs x defined earlier in the
// chain. The result is one flat `storage` object with every method, exactly
// as before the split — consumers import { storage } from "./storage" (this
// directory) and notice nothing.
//
// IStorage is DERIVED from the class instead of hand-maintained: the old
// 733-line interface had to be edited in lockstep with every method change.
// Add new methods to the matching domain file (or a new chain link).
import { LeadsStorage } from "./leads";

export class DatabaseStorage extends LeadsStorage {}

export const storage = new DatabaseStorage();

/** The storage surface, for DI-style route registrars. */
export type IStorage = DatabaseStorage;

export { InvalidSsnError } from "./urla";
