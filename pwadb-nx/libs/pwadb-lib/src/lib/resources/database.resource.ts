import { createRxDatabase, addRxPlugin, RxDatabase, RxDatabaseCreator } from 'rxdb';
import { from, Observable, of } from 'rxjs';
import { map, switchMap, startWith, shareReplay } from 'rxjs/operators';
// import { RxDBEncryptionPlugin } from 'rxdb/plugins/encryption';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
// import { RxDBValidatePlugin } from 'rxdb/plugins/validate';
import { RxDBMigrationPlugin } from 'rxdb/plugins/migration';
import { wrappedKeyEncryptionStorage } from 'rxdb/plugins/encryption';
import { getRxStorageDexie } from 'rxdb/plugins/dexie';
// import { getRxStoragePouch, addPouchPlugin } from 'rxdb/plugins/pouchdb';
// import * as idb from 'pouchdb-adapter-idb';

// add pouchdb plugin
// addPouchPlugin(idb);

// add encryption plugin
// addRxPlugin(RxDBEncryptionPlugin);

// add leader election plugin
addRxPlugin(RxDBLeaderElectionPlugin);

// add schema validate plugin
// addRxPlugin(RxDBValidatePlugin);

// add migration plugin
addRxPlugin(RxDBMigrationPlugin);


export interface PwaDatabaseCreator {
    dbCreator: Partial<RxDatabaseCreator>;
}


export class PwaDatabaseService<T> {

    db$: Observable<RxDatabase<T>>;

    constructor(private _config: PwaDatabaseCreator) {

        const encryptedDexieStorage = wrappedKeyEncryptionStorage({
            storage: getRxStorageDexie(),
        });

        // const pouchAdapter = getRxStoragePouch('idb');

        // pouchAdapter.pouchSettings.revs_limit       = 0,
        // pouchAdapter.pouchSettings.auto_compaction  = true;

        this.db$ = from(createRxDatabase({
            name: 'pwadb',
            storage: encryptedDexieStorage,
            password: 'ubT6LIL7ne2bdpze0V1DaeOGKKqYMWVF',
            multiInstance: true,
            eventReduce: true,
            ...this._config.dbCreator
        })).pipe(

            switchMap((db: any) => from(db.waitForLeadership()).pipe(

                startWith(null),

                map(() => db),
            )),

            shareReplay(1),
        );
    }

}
