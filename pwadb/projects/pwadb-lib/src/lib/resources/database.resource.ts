import { createRxDatabase, addRxPlugin, RxDatabase, RxDatabaseCreator } from 'rxdb';
import { from, Observable, combineLatest, BehaviorSubject, forkJoin, empty, of, throwError } from 'rxjs';
import { map, switchMap, filter, catchError, startWith, shareReplay, first, finalize, concatMap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { PwaCollection, getCollectionCreator, pwaCollectionMethods } from '../definitions/collection';
import { PwaDocument, pwaDocMethods } from '../definitions/document';
import idb from 'pouchdb-adapter-idb';
import { enterZone } from './operators.resource';
import { NgZone } from '@angular/core';


export class PwaDatabaseService<T> {

    db$: Observable<RxDatabase<T>>;

    private retryChange: BehaviorSubject<boolean>;

    constructor(private httpClient: HttpClient, private zone: NgZone, dbCreator: RxDatabaseCreator = {
        name: 'pwadb',
        adapter: 'idb',
        password: 'ubT6LIL7ne2bdpze0V1DaeOGKKqYMWVF',     // <- password (optional)
        multiInstance: true,         // <- multiInstance (optional, default: true)
        eventReduce: true, // <- queryChangeDetection (optional, default: false)
    }) {

        // add indexeddb adapter
        addRxPlugin(idb);

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

    retrySync() {

        this.retryChange.next(true);
    }

    stopSync() {

        this.retryChange.next(false);
    }

    getCollections(collectionNames: string[]): Observable<PwaCollection<any>[]> {

        return this.db$.pipe(

            switchMap(db => {

                // list of collections that exists
                const collectionsExists = collectionNames
                    .filter(k => k in db.collections)
                    .map(k => db.collections[k] as PwaCollection<any>);

                // dictionary of collections that does not exists
                const collectionsDoesNotExists = collectionNames
                    .filter(k => !(k in db.collections))
                    .reduce((collections, k) => {

                        collections[k] = getCollectionCreator(k, pwaCollectionMethods, pwaDocMethods);

                        return collections;

                    }, {});

                return from(db.addCollections(collectionsDoesNotExists)).pipe(

                    map((newCollections) => collectionsExists.concat(Object.values(newCollections)))
                );
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

                        map(docs => docs.map(d => ({collectionName: k.name, document: d}))),

                    ));
                });

                return combineLatest(sortedDocs$);

            }),

            map(sortedDocs => [].concat(...sortedDocs)),

            // tslint:disable-next-line: max-line-length
            map((sortedDocs: {collectionName: string, document: PwaDocument<any>}[]) => sortedDocs.sort((a, b) => order === 'asc' ? a.document.time - b.document.time : b.document.time - a.document.time)),

            enterZone<{collectionName: string, document: PwaDocument<any>}[]>(this.zone),
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

        const hit = pop.pipe(

            concatMap(doc => {

                if (doc.method === 'POST') {

                    const url = doc.tenantUrl.split('____')[1].split('/');

                    url.splice(url.length - 1, 1);

                    return this.httpClient.post(url.join('/'), doc.data).pipe(

                        switchMap(res => doc.atomicUpdate(oldData => ({
                            ...oldData,
                            method: 'GET',
                            data: res,
                            error: null,
                            time: new Date().getTime()
                        }))),

                        catchError(err => {

                            return from(doc.atomicUpdate(oldDoc => {

                                oldDoc.error = JSON.stringify(err);

                                return oldDoc;

                            })).pipe(

                                finalize(() => this.retryChange.next(false)),
                            );
                        }),

                    );

                } else if (doc.method === 'PUT') {

                    return this.httpClient.put(doc.tenantUrl.split('____')[1], doc.data).pipe(

                        switchMap(res => doc.atomicUpdate(oldData => ({
                            ...oldData,
                            method: 'GET',
                            data: res,
                            error: null,
                            time: new Date().getTime()
                        }))),

                        catchError(err => {

                            return from(doc.atomicUpdate(oldDoc => {

                                oldDoc.error = JSON.stringify(err);

                                return oldDoc;

                            })).pipe(

                                finalize(() => this.retryChange.next(false)),
                            );
                        }),

                    );

                } else if (doc.method === 'DELETE') {

                    return this.httpClient.delete(doc.tenantUrl.split('____')[1]).pipe(

                        switchMap(() => doc.remove()),

                        catchError(err => {

                            return from(doc.atomicUpdate(oldDoc => {

                                oldDoc.error = JSON.stringify(err);

                                return oldDoc;

                            })).pipe(

                                finalize(() => this.retryChange.next(false)),
                            );
                        }),

                    );
                }

                return throwError(`Document doesn\'t have valid method. Document: ${JSON.stringify(doc?.toJSON())}`);
            }),

        );

        return this.retryChange.asObservable().pipe(

            switchMap(trigger => trigger ? hit : empty())
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

        if (!!doc && doc.method !== 'GET' && doc.method !== 'POST') {

            return from(doc.atomicUpdate(oldDoc => {

                oldDoc.method = 'POST';

                return oldDoc;

            }));
        }

        return throwError(`Cannot duplicate this document. Document: ${JSON.stringify(doc?.toJSON() || {})}`);
    }

    deleteConflict(doc: PwaDocument<any>): Observable<boolean> {

        if (!!doc && doc.method !== 'GET') {

            return from(doc.remove());
        }

        return throwError(`Cannot delete this document. Document: ${JSON.stringify(doc?.toJSON() || {})}`);
    }

}
