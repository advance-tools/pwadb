import { addRxPlugin, createRxDatabase, RxDatabase, RxDatabaseCreator } from 'rxdb';
import { from, Observable } from 'rxjs';
import idb from 'pouchdb-adapter-idb';
import { RxDBEncryptionPlugin } from 'rxdb/plugins/encryption';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { RxDBValidatePlugin } from 'rxdb/plugins/validate';
import { first, map, shareReplay, startWith, switchMap } from 'rxjs/operators';
import { SynchroniseCollection } from '../definitions/synchronise-collection';

export class SynchroniseDatabaseService {

    db$: Observable<RxDatabase<any>>;

    constructor(dbCreator: Partial<RxDatabaseCreator> = {}) {

        // add indexeddb adapter
        addRxPlugin(idb);

        // add encryption plugin
        addRxPlugin(RxDBEncryptionPlugin);

        // add leader election plugin
        addRxPlugin(RxDBLeaderElectionPlugin);

        // add schema validate plugin
        addRxPlugin(RxDBValidatePlugin);

        this.db$ = from(createRxDatabase({
            name: 'synchronise-pwadb',
            adapter: 'idb',
            password: 'ubT6LIL7ne2bdpze0V1DaeOGKKqYMWVF',
            multiInstance: true,
            eventReduce: true,
            ...dbCreator
        })).pipe(

            switchMap((db: any) => from(db.waitForLeadership()).pipe(

                startWith(null),

                map(() => db),
            )),

            shareReplay(1),

            first(),

        );
    }
}

