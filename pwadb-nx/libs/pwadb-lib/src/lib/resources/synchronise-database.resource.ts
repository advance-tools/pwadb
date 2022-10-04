import { addRxPlugin, createRxDatabase, RxDatabase, RxDatabaseCreator } from 'rxdb';
import { from, Observable, of } from 'rxjs';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
// import { getRxStoragePouch, addPouchPlugin } from 'rxdb/plugins/pouchdb';
import { RxDBMigrationPlugin } from 'rxdb/plugins/migration';
import { map, shareReplay, startWith, switchMap } from 'rxjs/operators';
import { wrappedKeyEncryptionStorage } from 'rxdb/plugins/encryption';
import { getRxStorageDexie } from 'rxdb/plugins/dexie';
import { isDevMode } from '@angular/core';


// // add pouchdb plugin
// addPouchPlugin(idb);

// add encryption plugin
// addRxPlugin(RxDBEncryptionPlugin);

// add leader election plugin
addRxPlugin(RxDBLeaderElectionPlugin);

// add schema validate plugin
// addRxPlugin(RxDBValidatePlugin);

// add migration plugin
addRxPlugin(RxDBMigrationPlugin);


export interface SyncDatabaseServiceCreator {
    dbCreator: Partial<RxDatabaseCreator>;
}


export class SyncDatabaseService {

    // tslint:disable-next-line: variable-name
    db$: Observable<RxDatabase>;

    constructor(private _config: SyncDatabaseServiceCreator) {

        const encryptedDexieStorage = wrappedKeyEncryptionStorage({
            storage: getRxStorageDexie(),
        });

        // pouchAdapter.pouchSettings.revs_limit       = 0,
        // pouchAdapter.pouchSettings.auto_compaction  = true;

        this.db$ = of(isDevMode()).pipe(

            switchMap(v => {

                if (v) {

                    return from(import('rxdb/plugins/dev-mode').then(module => addRxPlugin(module as any)))
                }

                return of(null);
            }),

            switchMap(() => from(createRxDatabase({
                name: 'synchronise/pwadb',
                storage: encryptedDexieStorage,
                password: 'ubT6LIL7ne2bdpze0V1DaeOGKKqYMWVF',
                multiInstance: true,
                eventReduce: true,
                ...this._config.dbCreator
            }))),

            switchMap((db: any) => from(db.waitForLeadership()).pipe(

                startWith(null),

                map(() => db),
            )),

            shareReplay(1),
        );

    }

}

