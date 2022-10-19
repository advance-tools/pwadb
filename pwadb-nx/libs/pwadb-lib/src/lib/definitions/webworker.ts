import { getRxStorageWorker } from 'rxdb/plugins/worker';
import { RxStorageDexieStatics } from 'rxdb/plugins/dexie';


export const dexieWorker = getRxStorageWorker({
    statics: RxStorageDexieStatics,
    workerInput: '/dexie.worker.js',
});
