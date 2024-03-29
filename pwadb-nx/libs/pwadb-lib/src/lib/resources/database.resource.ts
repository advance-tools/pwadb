import { createRxDatabase, addRxPlugin, RxDatabase, RxDatabaseCreator, RxStorage } from 'rxdb';
import { from, Observable, of } from 'rxjs';
import { shareReplay, tap } from 'rxjs/operators';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { RxDBMigrationPlugin } from 'rxdb/plugins/migration';
import { wrappedKeyEncryptionCryptoJsStorage } from 'rxdb/plugins/encryption-crypto-js';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';


// add leader election plugin
addRxPlugin(RxDBLeaderElectionPlugin);

// add migration plugin
addRxPlugin(RxDBMigrationPlugin);


export interface PwaDatabaseCreator {
    dbCreator: Partial<RxDatabaseCreator>;
}


export class PwaDatabaseService<T> {

    db$: Observable<RxDatabase<T>>;

    constructor(private _config: PwaDatabaseCreator) {

        const encryptedDexieStorage = wrappedKeyEncryptionCryptoJsStorage({
            storage: getRxStorageDexie(),
        }) as RxStorage<any, any>;

        const dbCreator = {
            name: 'pwadb',
            storage: encryptedDexieStorage,
            password: 'ubT6LIL7ne2bdpze0V1DaeOGKKqYMWVF',
            multiInstance: true,
            eventReduce: true,
            cleanupPolicy: {
                /**
                 * The minimum time in milliseconds for how long
                 * a document has to be deleted before it is
                 * purged by the cleanup.
                 * [default=one month]
                 */
                minimumDeletedTime: 0,//1000 * 60 * 60 * 24 * 31, // one month,
                /**
                 * The minimum amount of that that the RxCollection must have existed.
                 * This ensures that at the initial page load, more important
                 * tasks are not slowed down because a cleanup process is running.
                 * [default=60 seconds]
                 */
                minimumCollectionAge: 1000 * 60, // 60 seconds
                /**
                 * After the initial cleanup is done,
                 * a new cleanup is started after [runEach] milliseconds
                 * [default=5 minutes]
                 */
                runEach: 3000,//1000 * 60 * 5, // 3 seconds
                /**
                 * If set to true,
                 * RxDB will await all running replications
                 * to not have a replication cycle running.
                 * This ensures we do not remove deleted documents
                 * when they might not have already been replicated.
                 * [default=true]
                 */
                awaitReplicationsInSync: false,
                /**
                 * If true, it will only start the cleanup
                 * when the current instance is also the leader.
                 * This ensures that when RxDB is used in multiInstance mode,
                 * only one instance will start the cleanup.
                 * [default=true]
                 */
                waitForLeadership: true
            },
            ...this._config.dbCreator
        };

        if ('pwadb-lib' in window && 'databaseMap' in (window['pwadb-lib'] as Record<string, any>) && dbCreator.name in (window['pwadb-lib']['databaseMap'] as Record<string, RxDatabase>)) {

            this.db$ = window['pwadb-lib']['databaseMap'][dbCreator.name];

        } else {

            if (!('pwadb-lib' in window)) window['pwadb-lib'] = {};

            if (!('databaseMap' in (window['pwadb-lib'] as Record<string, any>))) window['pwadb-lib']['databaseMap'] = {};

            window['pwadb-lib']['databaseMap'][dbCreator.name] = from(createRxDatabase<any>(dbCreator)).pipe(

                shareReplay(1),
            );

            this.db$ = window['pwadb-lib']['databaseMap'][dbCreator.name];
        }
    }

}
