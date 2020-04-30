import RxDB, { RxDatabase, RxDatabaseCreator } from 'rxdb';
import idb from 'pouchdb-adapter-idb';
import { from, Observable, combineLatest, BehaviorSubject, forkJoin } from 'rxjs';
import { map, switchMap, filter, catchError, startWith } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { PwaCollection } from '../definitions/collection';
import { PwaDocument } from '../definitions/document';

export class PwaDatabaseService<T> {

    db$: Observable<RxDatabase<T>>;

    retrySync: BehaviorSubject<boolean>;

    constructor(private httpClient: HttpClient, dbCreator: RxDatabaseCreator = {
        name: 'pwadb',
        adapter: 'idb',
        password: 'ubT6LIL7ne2bdpze0V1DaeOGKKqYMWVF',     // <- password (optional)
        multiInstance: true,         // <- multiInstance (optional, default: true)
        queryChangeDetection: true // <- queryChangeDetection (optional, default: false)
    }) {

        RxDB.plugin(idb);

        this.db$ = from(RxDB.create(dbCreator)).pipe(

            switchMap((db: any) => from(db.waitForLeadership()).pipe(

                startWith(null),

                map(() => db),
            )),

        );

        this.retrySync = new BehaviorSubject(false);
    }

    unsynchronised(tenant: string, collectionNames: string[], order: 'desc' | 'asc' = 'asc'): Observable<PwaDocument<any>[]> {

        return this.db$.pipe(

            map(db => collectionNames.map(k => db[k]) as PwaCollection<any>[]),

            map(cols => cols.map(c => c.findOne({$and: [{tenant: {$eq: tenant}}, {method: {$ne: 'GET'}}]}).sort({time: order}).$)),

            switchMap(cols => combineLatest(cols)),

            map(sortedDocs => sortedDocs.filter(v => !!v)),

            map(sortedDocs => sortedDocs.sort((a, b) => order === 'asc' ? a.time - b.time : b.time - a.time)),
        );
    }

    synchronise(tenant: string, collectionNames: string[]): Observable<boolean> {

        const pop: Observable<PwaDocument<any>> = this.unsynchronised(tenant, collectionNames, 'asc').pipe(

            filter(sortedDocs => sortedDocs.length > 0),

            map(sortedDocs => sortedDocs[0]),

        );

        return this.retrySync.asObservable().pipe(

            switchMap(trigger => pop.pipe(

                filter(doc => !doc.error || (!!doc.error && trigger)),

                switchMap(doc => {

                    let request: Observable<any>;

                    if (doc.method === 'POST') {

                        request = this.httpClient.post(doc.tenantUrl.split('-')[1], doc.data);

                    } else if (doc.method === 'PUT') {

                        request = this.httpClient.put(doc.tenantUrl.split('-')[1], doc.data);

                    } else {

                        request = this.httpClient.delete(doc.tenantUrl.split('-')[1]);
                    }

                    return request.pipe(

                        switchMap(() => doc.atomicSet('error', null)),

                        catchError(err => doc.atomicSet('error', JSON.stringify(err))),
                    );
                }),

                filter(doc => !doc.error),

                switchMap(doc => doc.remove()),

            ))
        );


    }

    evict(collectionInfo: {name: string, evictionDays?: number, skip?: number}[]): Observable<PwaDocument<any>[]> {

        return this.db$.pipe(

            map(db => collectionInfo.map(k => {
                
                const col = db[k.name] as PwaCollection<any>;

                const today = new Date();

                const evictionTime = new Date(today.setDate(today.getDate() - (k.evictionDays || 14))).getTime();

                return col.find({$and: [{method: {$eq: 'GET'}}, {time: {$lt: evictionTime}}]}).skip(k.skip || 0).remove();
            })),

            switchMap(v => forkJoin(...v))
        );
    } 

}
