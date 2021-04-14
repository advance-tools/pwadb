import { createRxDatabase, addRxPlugin, RxDatabase, RxDatabaseCreator } from 'rxdb';
import { from, Observable } from 'rxjs';
import { map, switchMap, startWith, shareReplay, first } from 'rxjs/operators';
import idb from 'pouchdb-adapter-idb';
import { RxDBEncryptionPlugin } from 'rxdb/plugins/encryption';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { RxDBValidatePlugin } from 'rxdb/plugins/validate';


export interface PwaDatabaseCreator {
    dbCreator: Partial<RxDatabaseCreator>;
}


export class PwaDatabaseService<T> {

    // tslint:disable-next-line: variable-name
    private _db$: Observable<RxDatabase<T>>;

    constructor(private _config: PwaDatabaseCreator) {}

    get db$(): Observable<RxDatabase<T>> {

        if (this._db$) { return this._db$; }

        // add indexeddb adapter
        addRxPlugin(idb);

        // add encryption plugin
        addRxPlugin(RxDBEncryptionPlugin);

        // add leader election plugin
        addRxPlugin(RxDBLeaderElectionPlugin);

        // add schema validate plugin
        addRxPlugin(RxDBValidatePlugin);

        this._db$ = from(createRxDatabase({
            name: 'pwadb',
            adapter: 'idb',
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

            first(),

        );

        return this._db$;

    }

}
