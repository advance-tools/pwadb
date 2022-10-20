import { createRxDatabase, addRxPlugin, RxDatabase, RxDatabaseCreator } from 'rxdb';
import { from, Observable, of } from 'rxjs';
import { map, switchMap, startWith, shareReplay } from 'rxjs/operators';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { RxDBMigrationPlugin } from 'rxdb/plugins/migration';
import { wrappedKeyEncryptionStorage } from 'rxdb/plugins/encryption';
import { dexieWorker } from '../definitions/webworker';

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

        const encryptedDexieStorage = wrappedKeyEncryptionStorage({
            storage: dexieWorker,
        });

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

                map(v => v ? v : db),
            )),

            shareReplay(1),
        );
    }

}
