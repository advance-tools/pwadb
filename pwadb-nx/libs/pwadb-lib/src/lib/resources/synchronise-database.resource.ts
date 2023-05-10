import { addRxPlugin, createRxDatabase, RxDatabase, RxDatabaseCreator, RxStorage } from 'rxdb';
import { from, Observable, of } from 'rxjs';
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

    // tslint:disable-next-line: variable-name
    db$: Observable<RxDatabase>;

    constructor(private _config: SyncDatabaseServiceCreator) {

        const encryptedDexieStorage = wrappedKeyEncryptionCryptoJsStorage({
            storage: getRxStorageDexie(),
        }) as RxStorage<any, any>;

        const dbCreator = {
            name: 'synchronise/pwadb',
            storage: encryptedDexieStorage,
            password: 'ubT6LIL7ne2bdpze0V1DaeOGKKqYMWVF',
            multiInstance: true,
            eventReduce: true,
            ...this._config.dbCreator
        };

        let db$ = null;

        if ('pwadb-lib' in window && 'databaseMap' in (window['pwadb-lib'] as Record<string, any>) && dbCreator.name in (window['pwadb-lib']['databaseMap'] as Record<string, RxDatabase>)) {

            db$ = of(window['pwadb-lib']['databaseMap'][dbCreator.name]);

            console.log('SyncDatabaseService: db fetched from cache', dbCreator.name);

        } else {

            db$ = from(createRxDatabase<any>(dbCreator)).pipe(

                tap((db: RxDatabase<any>) => {

                    if (!('pwadb-lib' in window)) window['pwadb-lib'] = {};

                    if (!('databaseMap' in (window['pwadb-lib'] as Record<string, any>))) window['pwadb-lib']['databaseMap'] = {};

                    window['pwadb-lib']['databaseMap'][dbCreator.name] = db;
                }),
            );

            console.log('SyncDatabaseService: db created', dbCreator.name);
        }

        this.db$ = db$.pipe(

            // switchMap((db: any) => from(db.waitForLeadership()).pipe(

            //     startWith(null),

            //     map(() => db),
            // )),

            shareReplay(1),
        );

    }

}

