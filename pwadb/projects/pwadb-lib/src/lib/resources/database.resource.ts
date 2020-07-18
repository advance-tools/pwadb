import { createRxDatabase, addRxPlugin, RxDatabase, RxDatabaseCreator } from 'rxdb';
import { from, Observable, combineLatest, BehaviorSubject, forkJoin, empty, of, throwError } from 'rxjs';
import { map, switchMap, filter, catchError, startWith, shareReplay, first, finalize, distinctUntilChanged } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { PwaCollection, getCollectionCreator, pwaCollectionMethods } from '../definitions/collection';
import { PwaDocument, pwaDocMethods } from '../definitions/document';
import idb from 'pouchdb-adapter-idb';
// import memory from 'pouchdb-adapter-memory';

export class PwaDatabaseService<T> {

    db$: Observable<RxDatabase<T>>;

    private retryChange: BehaviorSubject<boolean>;

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

        this.retryChange = new BehaviorSubject(true);
    }

    isIndexeddbAvailable() {

        return window?.indexedDB || (window as any)?.mozIndexedDB || (window as any)?.webkitIndexedDB || (window as any)?.msIndexedDB;
    }

    retry() {

        this.retryChange.next(true);
    }

    getCollections(collectionNames: string[]): Observable<PwaCollection<any>[]> {

        return this.db$.pipe(

            switchMap(db => {

                const collectionsExists = collectionNames
                    .filter(k => k in db.collections)
                    .map(k => of(db.collections[k] as PwaCollection<any>));

                const collectionsDoesNotExists = collectionNames
                    .filter(k => !(k in db.collections))
                    .map(k => from(db.collection(getCollectionCreator(k, pwaCollectionMethods, pwaDocMethods))));

                const collections = collectionsExists.concat(collectionsDoesNotExists);

                return combineLatest(collections);
            }),
        );
    }

    // tslint:disable-next-line: max-line-length
    unsynchronised(tenant: string, collectionNames: string[], order: 'desc' | 'asc' = 'asc'): Observable<{collectionName: string, document: PwaDocument<any>}[]> {

        return this.getCollections(collectionNames).pipe(

            switchMap(collections => {

                const query = {
                    selector: {
                        matchUrl: {$regex: new RegExp(`^${tenant}.*`)},
                        method: {$ne: 'GET'}
                    },
                };

                const sortedDocs$ = collections.map(k => {

                    return from(k.find(query).$.pipe(

                        distinctUntilChanged(),

                        map(docs => docs.map(d => ({collectionName: k.name, document: d}))),
                    ));
                });

                return combineLatest(sortedDocs$);

            }),

            map(sortedDocs => [].concat(...sortedDocs)),

            // tslint:disable-next-line: max-line-length
            map((sortedDocs: {collectionName: string, document: PwaDocument<any>}[]) => sortedDocs.sort((a, b) => order === 'asc' ? a.document.time - b.document.time : b.document.time - a.document.time)),
        );
    }

    //////////////////
    // Actions
    //////////////////
    synchronise(tenant: string, collectionNames: string[]): Observable<PwaDocument<any> | boolean> {

        const pop: Observable<PwaDocument<any>> = this.unsynchronised(tenant, collectionNames, 'asc').pipe(

            filter(sortedDocs => sortedDocs.length > 0),

            map(sortedDocs => sortedDocs[0].document),

        );

        return this.retryChange.asObservable().pipe(

            switchMap(trigger => {

                const hit = pop.pipe(

                    switchMap(doc => {

                        if (doc.method === 'POST') {

                            return this.httpClient.post(doc.tenantUrl.split('----')[1], doc.data).pipe(

                                switchMap(res => doc.atomicUpdate(oldData => ({
                                    ...oldData,
                                    method: 'GET',
                                    data: res,
                                    error: null,
                                    time: new Date().getTime()
                                }))),

                                catchError(err => {

                                    return from(doc.atomicSet('error', JSON.stringify(err))).pipe(

                                        finalize(() => this.retryChange.next(false)),
                                    );
                                }),

                            );

                        } else if (doc.method === 'PUT') {

                            return this.httpClient.put(doc.tenantUrl.split('----')[1], doc.data).pipe(

                                switchMap(res => doc.atomicUpdate(oldData => ({
                                    ...oldData,
                                    method: 'GET',
                                    data: res,
                                    error: null,
                                    time: new Date().getTime()
                                }))),

                                catchError(err => {

                                    return from(doc.atomicSet('error', JSON.stringify(err))).pipe(

                                        finalize(() => this.retryChange.next(false)),
                                    );
                                }),

                            );

                        } else if (doc.method === 'DELETE') {

                            return this.httpClient.delete(doc.tenantUrl.split('----')[1]).pipe(

                                switchMap(() => doc.remove()),

                                catchError(err => {

                                    return from(doc.atomicSet('error', JSON.stringify(err))).pipe(

                                        finalize(() => this.retryChange.next(false)),
                                    );
                                }),

                            );
                        }

                        return throwError(`Document doesn\'t have valid method. Document: ${JSON.stringify(doc?.toJSON())}`);
                    }),

                );

                return trigger ? hit : empty();
            })
        );

    }

    evict(collectionInfo: {[name: string]: number}): Observable<PwaDocument<any>[]> {

        const collectionsNames = Object.keys(collectionInfo);

        return this.getCollections(collectionsNames).pipe(

            map(collections => {

                return collections.map(c => {

                    const cacheAllowedAge = new Date().getTime() - (collectionInfo[c.name] * 1000);

                    return from(c.find({selector: {$and: [{method: {$eq: 'GET'}}, {time: {$lt: cacheAllowedAge}}]}}).remove());
                });
            }),

            switchMap(v => forkJoin(...v))
        );
    }

    skipTrim(collectionInfo: {[name: string]: number}): Observable<PwaDocument<any>[]> {

        const collectionsNames = Object.keys(collectionInfo);

        return this.getCollections(collectionsNames).pipe(

            map((collections: PwaCollection<any>[]) => {

                return collections.map(c => {

                    return from(c.find({selector: {method: {$eq: 'GET'}}, sort: [{time: 'desc'}], skip: collectionInfo[c.name]}).remove());
                });
            }),

            switchMap(v => forkJoin(...v))
        );
    }

    ///////////////////
    // Conflict Actions
    ///////////////////

    createNew(doc: PwaDocument<any>): Observable<PwaDocument<any>> {

        if (doc?.method !== 'GET' && doc?.method !== 'POST') {

            return from(doc.atomicSet('method', 'POST'));
        }

        return throwError(`Cannot duplicate this document. Document: ${JSON.stringify(doc?.toJSON())}`);
    }

    deleteConflict(doc: PwaDocument<any>): Observable<boolean> {

        if (doc?.method !== 'GET') {

            return from(doc.remove());
        }

        return throwError(`Cannot delete this document. Document: ${JSON.stringify(doc?.toJSON())}`);
    }

}
