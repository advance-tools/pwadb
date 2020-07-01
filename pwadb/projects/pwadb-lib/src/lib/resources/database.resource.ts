import { createRxDatabase, addRxPlugin, RxDatabase, RxDatabaseCreator } from 'rxdb';
import { from, Observable, combineLatest, BehaviorSubject, forkJoin, empty } from 'rxjs';
import { map, switchMap, filter, catchError, startWith, shareReplay, first } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { PwaCollection } from '../definitions/collection';
import { PwaDocument } from '../definitions/document';
import idb from 'pouchdb-adapter-idb';
// import memory from 'pouchdb-adapter-memory';

export class PwaDatabaseService<T> {

    db$: Observable<RxDatabase<T>>;

    private retryChange: BehaviorSubject<boolean>;
    private retryTrigger = false;

    constructor(private httpClient: HttpClient, dbCreator: RxDatabaseCreator = {
        name: 'pwadb',
        adapter: 'idb',
        password: 'ubT6LIL7ne2bdpze0V1DaeOGKKqYMWVF',     // <- password (optional)
        multiInstance: true,         // <- multiInstance (optional, default: true)
        eventReduce: true, // <- queryChangeDetection (optional, default: false)
    }) {

        addRxPlugin(idb);
        // addRxPlugin(memory);

        // dbCreator.adapter = this.isIndexeddbAvailable() ? 'idb' : 'memory';

        this.db$ = from(createRxDatabase(dbCreator)).pipe(
    
            switchMap((db: any) => from(db.waitForLeadership()).pipe(

                startWith(null),

                map(() => db),
            )),

            shareReplay(1),

            first(),

        );

        this.retryChange = new BehaviorSubject(false);
    }

    isIndexeddbAvailable() {

        return window?.indexedDB || (window as any)?.mozIndexedDB || (window as any)?.webkitIndexedDB || (window as any)?.msIndexedDB;
    }

    retry() {

        this.retryTrigger = true;

        this.retryChange.next(true);
    }

    unsynchronised(tenant: string, collectionNames: string[], order: 'desc' | 'asc' = 'asc'): Observable<{collectionName: string, document: PwaDocument<any>}[]> {

        return this.db$.pipe(

            map(db => collectionNames.map(k => ({collectionName: k, documents$: (db[k] as PwaCollection<any>).find({selector: {$and: [{tenant: {$eq: tenant}}, {method: {$ne: 'GET'}}]}, sort: [{time: order}]}).$}))),

            switchMap(v => combineLatest(v.map(x => x.documents$.pipe(map(docs => docs.map(d => ({collectionName: x.collectionName, document: d}))))))),

            map(sortedDocs => [].concat(...sortedDocs)),

            map((sortedDocs: {collectionName: string, document: PwaDocument<any>}[]) => sortedDocs.sort((a, b) => order === 'asc' ? a.document.time - b.document.time : b.document.time - a.document.time)),
        );
    }

    synchronise(tenant: string, collectionNames: string[]): Observable<PwaDocument<any> | boolean> {

        const pop: Observable<PwaDocument<any>> = this.unsynchronised(tenant, collectionNames, 'asc').pipe(

            filter(sortedDocs => sortedDocs.length > 0),

            map(sortedDocs => sortedDocs[0].document),

        );

        return this.retryChange.asObservable().pipe(

            switchMap(() => pop.pipe(

                filter(doc => !doc.error || (doc.error && this.retryTrigger)),

                switchMap(doc => {

                    this.retryTrigger = false;

                    if (doc.method === 'POST') {

                        return this.httpClient.post(doc.tenantUrl.split('-')[1], doc.data).pipe(

                            switchMap(res => doc.atomicUpdate(oldData => ({
                                ...oldData,
                                method: 'GET',
                                data: res,
                                error: null,
                                time: new Date().getTime()
                            }))),

                            catchError(err => doc.atomicSet('error', JSON.stringify(err))),
                            
                        );

                    } else if (doc.method === 'PUT') {

                        return this.httpClient.put(doc.tenantUrl.split('-')[1], doc.data).pipe(

                            switchMap(res => doc.atomicUpdate(oldData => ({
                                ...oldData,
                                method: 'GET',
                                data: res,
                                error: null,
                                time: new Date().getTime()
                            }))),

                            catchError(err => doc.atomicSet('error', JSON.stringify(err))),

                        );

                    } else if (doc.method === 'DELETE') {

                        return this.httpClient.delete(doc.tenantUrl.split('-')[1]).pipe(

                            switchMap(() => doc.remove()),

                            catchError(err => doc.atomicSet('error', JSON.stringify(err))),

                        );
                    }

                    return empty();
                }),

            ))
        );

    }

    evict(collectionInfo: {name: string, cacheMaxAge: number}[]): Observable<PwaDocument<any>[]> {

        return this.db$.pipe(

            map(db => collectionInfo.map(k => {
                
                const col = db[k.name] as PwaCollection<any>;

                const cacheAllowedAge = new Date().getTime() - (k.cacheMaxAge * 1000);

                return col.find({selector: {$and: [{method: {$eq: 'GET'}}, {time: {$lt: cacheAllowedAge}}]}}).remove();
            })),

            switchMap(v => forkJoin(...v))
        );
    }
    
    trim(collectionInfo: {name: string, retainCacheSize: number}[]): Observable<PwaDocument<any>[]> {

        return this.db$.pipe(

            map(db => collectionInfo.map(k => {
                
                const col = db[k.name] as PwaCollection<any>;

                return col.find({
                    selector: {method: {$eq: 'GET'}},
                    sort: [{time: 'desc'}],
                    skip: k.retainCacheSize 
                }).remove();
            })),

            switchMap(v => forkJoin(...v))
        );
    }

}
