import { HttpClient } from '@angular/common/http';
import { NgZone } from '@angular/core';
import { RxDatabase } from 'rxdb';
import { BehaviorSubject, combineLatest, from, Observable, of, throwError } from 'rxjs';
import { catchError, concatMap, debounceTime, filter, finalize, first, map, shareReplay, switchMap } from 'rxjs/operators';
import { PwaCollection, pwaCollectionMethods } from '../definitions/collection';
import { pwaDocMethods, PwaDocument } from '../definitions/document';
import { getCollectionCreator, SynchroniseCollection, synchroniseCollectionMethods } from '../definitions/synchronise-collection';
import { synchroniseDocMethods, SynchroniseDocType, SynchroniseDocument } from '../definitions/synchronise-document';
import { enterZone } from './operators.resource';
import { PwaDatabaseService } from './database.resource';


export class SynchroniseCollectionService {

    collection$: Observable<SynchroniseCollection>;

    private retryChange: BehaviorSubject<boolean>;

    constructor(
        private name: string,
        private zone: NgZone,
        private httpClient: HttpClient,
        private db$: Observable<RxDatabase<any>>,
        config: {attachments?: {}, options?: {}, migrationStrategies?: {}, autoMigrate?: boolean} = {}
    ) {

        this.retryChange = new BehaviorSubject(true);

        const collectionSchema = {};

        const _config = {attachments: {}, options: {}, migrationStrategies: {}, autoMigrate: true, ...config};

        collectionSchema[name] = getCollectionCreator(
            this.name,
            synchroniseCollectionMethods,
            synchroniseDocMethods,
            _config.attachments,
            _config.options,
            _config.migrationStrategies,
            _config.autoMigrate
        );

        this.collection$ = this.db$.pipe(

            // tslint:disable-next-line: max-line-length
            switchMap(db => from(db.addCollections(collectionSchema))),

            map(collections => collections[name]),

            shareReplay(1),

            first()
        );
    }

    addSynchroniseDocument(data: SynchroniseDocType): Observable<SynchroniseDocument> {

        return this.collection$.pipe(

            switchMap(col => col.atomicUpsert(data))
        );
    }

    /////////////////////////////
    // Synchronisation Management
    //////////////////////////////

    retrySync() {

        this.retryChange.next(true);
    }

    stopSync() {

        this.retryChange.next(false);
    }

    getCollections(): Observable<{collection: PwaCollection<any>, skipDocuments: number, evictTime: number}[]> {

        return this.collection$.pipe(

            switchMap(col => col.find().$),

            debounceTime(100),

            map(docs => docs.map(d => d.toJSON())),

            map(docTypes => {

                // reduce collections to database wise
                const databasesSchema: {[key: string]: SynchroniseDocType[]} = {};

                docTypes.forEach(d => {

                    const key = JSON.stringify(d.databaseOptions);

                    key in databasesSchema ? databasesSchema[key].push(d) : databasesSchema[key] = [d];
                });

                // map RxDatabase and collectionNames

                const databasesMap: {database: Observable<RxDatabase>, collectionInfo: SynchroniseDocType[]}[] = [];

                Object.keys(databasesSchema).forEach(schema => {

                    const databaseService = new PwaDatabaseService<any>(JSON.parse(schema));

                    databasesMap.push({database: databaseService.db$, collectionInfo: databasesSchema[schema]});
                });

                return databasesMap;
            }),

            switchMap(databasesMap => combineLatest(databasesMap.map(m => {

                return m.database.pipe(

                    switchMap(db => {

                        const collectionInfoKeyValue = m.collectionInfo.reduce(
                            (cur: {collectionName: string, skipDocuments: number, evictTime: number}, acc: {}) => {

                                acc[cur.collectionName] = cur;

                                return acc;
                            }, {});

                        const collections = {};

                        m.collectionInfo.forEach(i => {

                            collections[i.collectionName] = getCollectionCreator(
                                i.collectionName,
                                pwaCollectionMethods,
                                pwaDocMethods,
                                i.collectionOptions.attachments,
                                i.collectionOptions.options,
                                i.collectionOptions.migrationStrategies,
                                i.collectionOptions.autoMigrate
                            );
                        });

                        return from(db.addCollections(collections)).pipe(

                            map(v => Object.keys(v).map(k => ({
                                collection: v[k] as PwaCollection<any>,
                                skipDocuments: collectionInfoKeyValue[k].skipDocuments as number,
                                evictTime: collectionInfoKeyValue[k].evictTime as number,
                            })))
                        );
                    })
                );

            }))),

            map(v => [].concat(v)),
        );
    }

    unsynchronised(tenant: string, order: 'desc' | 'asc' = 'asc'): Observable<{collectionName: string, document: PwaDocument<any>}[]> {

        return this.getCollections().pipe(

            switchMap((collectionsInfo) => {

                const query = {
                    selector: {
                        matchUrl: {$regex: new RegExp(`^${tenant}.*`)},
                        method: {$ne: 'GET'}
                    },
                };

                const sortedDocs$ = collectionsInfo.map(k => {

                    return from(k.collection.find(query).$.pipe(

                        map(docs => docs.map(d => ({collectionName: k.collection.name, document: d}))),

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

    synchronise(tenant: string): Observable<PwaDocument<any> | boolean> {

        const pop: Observable<PwaDocument<any>> = this.unsynchronised(tenant, 'asc').pipe(

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

            switchMap(trigger => trigger ? hit : of())

        ) as Observable<boolean | PwaDocument<any>>;

    }

    ////////////////////////
    // Evict Management
    ////////////////////////

    evict(): Observable<PwaDocument<any>[]> {

        return this.getCollections().pipe(

            map(collectionInfo => {

                return collectionInfo.map(k => {

                    const cacheAllowedAge = new Date().getTime() - (k.evictTime * 1000);

                    return from(k.collection.find({selector: {$and: [{method: {$eq: 'GET'}}, {time: {$lt: cacheAllowedAge}}]}}).remove());
                });
            }),

            switchMap(v => combineLatest(v)),

            map(v => [].concat(...v)),
        );

    }

    // tslint:disable-next-line: max-line-length
    skipTrim(): Observable<PwaDocument<any>[]> {

        return this.getCollections().pipe(

            map((collectionInfo) => {

                return collectionInfo.map(k => {

                    // tslint:disable-next-line: max-line-length
                    return from(k.collection.find({selector: {method: {$eq: 'GET'}}, sort: [{time: 'desc'}], skip: k.skipDocuments}).remove());
                });
            }),

            switchMap(v => combineLatest(v)),

            map(v => [].concat(...v)),
        );
    }

    ////////////////////////
    // Conflict Management
    ////////////////////////

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
