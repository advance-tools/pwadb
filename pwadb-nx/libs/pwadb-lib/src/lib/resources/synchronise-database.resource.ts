import { addRxPlugin, createRxDatabase, RxDatabase, RxDatabaseCreator } from 'rxdb';
import { from, Observable } from 'rxjs';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
// import { getRxStoragePouch, addPouchPlugin } from 'rxdb/plugins/pouchdb';
import { wrappedKeyEncryptionStorage } from 'rxdb/plugins/encryption';
import { RxDBMigrationPlugin } from 'rxdb/plugins/migration';
import { map, shareReplay, startWith, switchMap } from 'rxjs/operators';
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


if (isDevMode()) {

    await import('rxdb/plugins/dev-mode').then(
        module => addRxPlugin(module as any)
    );
}


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

        this.db$ = from(createRxDatabase({
            name: 'synchronise/pwadb',
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

            // first(),

        );

    }

}

