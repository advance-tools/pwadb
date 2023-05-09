import { addRxPlugin, createRxDatabase, RxDatabase, RxDatabaseCreator, RxStorage } from 'rxdb';
import { from, Observable } from 'rxjs';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { RxDBMigrationPlugin } from 'rxdb/plugins/migration';
import { finalize, map, shareReplay, tap } from 'rxjs/operators';
import { wrappedKeyEncryptionCryptoJsStorage } from 'rxdb/plugins/encryption-crypto-js';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { isDevMode } from '@angular/core';


// add leader election plugin
addRxPlugin(RxDBLeaderElectionPlugin);

// add migration plugin
addRxPlugin(RxDBMigrationPlugin);


export interface SyncDatabaseServiceCreator {
    dbCreator: Partial<RxDatabaseCreator>;
}


export class SyncDatabaseService {

    db: RxDatabase;
    // tslint:disable-next-line: variable-name
    db$: Observable<RxDatabase>;

    constructor(private _config: SyncDatabaseServiceCreator) {

        const encryptedDexieStorage = wrappedKeyEncryptionCryptoJsStorage({
            storage: getRxStorageDexie(),
        }) as RxStorage<any, any>;

        this.db$ = from(createRxDatabase<any>({
            name: 'synchronise/pwadb',
            storage: encryptedDexieStorage,
            password: 'ubT6LIL7ne2bdpze0V1DaeOGKKqYMWVF',
            multiInstance: true,
            eventReduce: true,
            ...this._config.dbCreator
        })).pipe(

            // switchMap((db: any) => from(db.waitForLeadership()).pipe(

            //     startWith(null),

            //     map(() => db),
            // )),

            map((db: RxDatabase<any>) => db),

            tap((db: RxDatabase<any>) => this.db = db),

            finalize(() => !!this.db ? this.db.destroy() : null),

            shareReplay(1),
        );

    }

}

