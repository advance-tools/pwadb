import { PwaCollection } from '@advance-tools/pwadb-lib';
import { FetchLog } from './schema.resource';

////////////////////////
// Database
////////////////////////

export interface CRMAuthDatabase {
    fetchLog    : PwaCollection<FetchLog>;
}

////////////////////////
// Collections
////////////////////////

export enum AuthCollections {
    fetchLog    = 'fetchLog',
}

export enum SynchronisationCollections {
    synchronisation = 'synchronisation',
}
