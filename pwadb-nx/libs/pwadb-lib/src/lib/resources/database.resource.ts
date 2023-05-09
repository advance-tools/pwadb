import { createRxDatabase, addRxPlugin, RxDatabase, RxDatabaseCreator, RxStorage } from 'rxdb';
import { from, Observable } from 'rxjs';
import { finalize, map, shareReplay, tap } from 'rxjs/operators';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { RxDBMigrationPlugin } from 'rxdb/plugins/migration';
import { wrappedKeyEncryptionCryptoJsStorage } from 'rxdb/plugins/encryption-crypto-js';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { isDevMode } from '@angular/core';


// add leader election plugin
addRxPlugin(RxDBLeaderElectionPlugin);

// add migration plugin
addRxPlugin(RxDBMigrationPlugin);


export interface PwaDatabaseCreator {
    dbCreator: Partial<RxDatabaseCreator>;
}


export class PwaDatabaseService<T> {

    db: RxDatabase<T>;
    db$: Observable<RxDatabase<T>>;

    constructor(private _config: PwaDatabaseCreator) {

        const encryptedDexieStorage = wrappedKeyEncryptionCryptoJsStorage({
            storage: getRxStorageDexie(),
        }) as RxStorage<any, any>;

        this.db$ = from(createRxDatabase({
            name: 'pwadb',
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
