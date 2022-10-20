import { addRxPlugin, createRxDatabase, RxDatabase, RxDatabaseCreator } from 'rxdb';
import { from, Observable } from 'rxjs';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { RxDBMigrationPlugin } from 'rxdb/plugins/migration';
import { map, shareReplay } from 'rxjs/operators';
import { wrappedKeyEncryptionStorage } from 'rxdb/plugins/encryption';
import { dexieWorker } from '../definitions/webworker';


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

        const encryptedDexieStorage = wrappedKeyEncryptionStorage({
            storage: dexieWorker,
        });

        this.db$ = from(createRxDatabase({
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

            shareReplay(1),
        );

    }

}

