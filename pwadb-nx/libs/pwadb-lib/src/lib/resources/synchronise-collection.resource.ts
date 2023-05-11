import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { NgZone } from '@angular/core';
import { RxCollection, RxCollectionCreator, RxDatabase } from 'rxdb';
import { BehaviorSubject, combineLatest, empty, from, interval, Observable, of, throwError } from 'rxjs';
import { bufferCount, catchError, concatMap, debounceTime, distinctUntilChanged, filter, finalize, map, mergeMap, shareReplay, startWith, switchMap, take, tap } from 'rxjs/operators';
import { getCollectionCreator, PwaCollection, pwaCollectionMethods } from '../definitions/collection';
import { pwaDocMethods, PwaDocument } from '../definitions/document';
import { getSynchroniseCollectionCreator, SynchroniseCollection, synchroniseCollectionMethods } from '../definitions/synchronise-collection';
import { synchroniseDocMethods, SynchroniseDocType, SynchroniseDocument } from '../definitions/synchronise-document';
import { enterZone } from './operators.resource';
import { PwaDatabaseService } from './database.resource';
import { createFormData, flatten } from './misc.resource';

interface Extras {
    collection: PwaCollection<any>;
}

type SynchroniseDocTypeExtras = SynchroniseDocType & Extras;


export interface SyncCollectionServiceCreator {
    name: string;
    db$: Observable<RxDatabase>;
    attachments?: {};
    options?: {};
    migrationStrategies?: {};
    autoMigrate?: boolean;
    ngZone: NgZone | null;
    httpClient: HttpClient | null;
}


export class SyncCollectionService {
    collection$: Observable<SynchroniseCollection>;
    retryChange: BehaviorSubject<boolean>;

    private config: SyncCollectionServiceCreator = {
        name: 'no_name_sync_collection',
        db$: of(),
        attachments: {},
        options: {},
        migrationStrategies: {},
        autoMigrate: true,
        ngZone: null,
        httpClient: null,
    };

    storedCollections: Observable<SynchroniseDocTypeExtras[]>;

    constructor(private _config: Partial<SyncCollectionServiceCreator>) {

        this.config = {
            ...this.config,
            ...this._config
        };

        /////////////////////
        // RxCollection
        /////////////////////

        this.collection$ = this.config.db$.pipe(

            switchMap((db: RxDatabase) => {

                let col$: Observable<SynchroniseCollection> = null;

                if ('pwadb-lib' in window && 'collectionMap' in (window['pwadb-lib'] as Record<string, any>) && this.config?.name in (window['pwadb-lib']['collectionMap'] as Record<string, RxCollection>)) {

                    col$ = of(window['pwadb-lib']['collectionMap'][this.config?.name]);

                    console.log('SynchroniseCollectionAPI: collection fetch from cache', this.config?.name);

                } else if (this.config?.name in db) {

                    if (!('pwadb-lib' in window)) window['pwadb-lib'] = {};

                    if (!('collectionMap' in (window['pwadb-lib'] as Record<string, any>))) window['pwadb-lib']['collectionMap'] = {};

                    window['pwadb-lib']['collectionMap'][this.config?.name] = db[this.config?.name];

                    col$ = of(window['pwadb-lib']['collectionMap'][this.config?.name]);

                    console.log('SynchroniseCollectionAPI: collection fetch from db', this.config?.name);

                } else {

                    const collectionSchema: Record<string, RxCollectionCreator> = {};

                    collectionSchema[this.config?.name] = getSynchroniseCollectionCreator(
                        this.config.name,
                        synchroniseCollectionMethods,
                        synchroniseDocMethods,
                        this.config.attachments,
                        this.config.options,
                        this.config.migrationStrategies,
                        this.config.autoMigrate
                    );

                    col$ = from(db.addCollections(collectionSchema)).pipe(

                        map((collections: Record<string, SynchroniseCollection>) => {

                            if (!('pwadb-lib' in window)) window['pwadb-lib'] = {};

                            if (!('collectionMap' in (window['pwadb-lib'] as Record<string, any>))) window['pwadb-lib']['collectionMap'] = {};

                            window['pwadb-lib']['collectionMap'][this.config?.name] = collections[this.config?.name];

                            return window['pwadb-lib']['collectionMap'][this.config?.name];
                        }),
                    );

                    console.log('SynchroniseCollectionAPI: collection created', this.config?.name);
                }

                return col$;
            }),

            shareReplay(1),
        );

        /////////////////////
        // Initialize
        /////////////////////

        this.retryChange = new BehaviorSubject<boolean>(true);

        this.storedCollections = this.collection$.pipe(

            switchMap(col => col.find().$),

            debounceTime(500),

            map(docs => docs.map(d => d.toMutableJSON())),

            map(docTypes => {

                // reduce collections to database wise
                const databasesSchema: {[key: string]: SynchroniseDocType[]} = {};

                docTypes.forEach(d => {

                    const key = d.databaseOptions;

                    key in databasesSchema ? databasesSchema[key].push(d) : databasesSchema[key] = [d];
                });

                // map RxDatabase and collectionNames
                const databasesMap: {pwaDatabaseService: PwaDatabaseService<any>, collectionInfo: SynchroniseDocType[]}[] = [];

                Object.keys(databasesSchema).forEach(schema => {

                    const pwaDatabaseService = new PwaDatabaseService<any>({dbCreator: {...JSON.parse(schema)}});

                    databasesMap.push({pwaDatabaseService, collectionInfo: databasesSchema[schema]});
                });

                return databasesMap;
            }),

            switchMap(databasesMap => combineLatest(databasesMap.map(m => {

                return m.pwaDatabaseService.db$.pipe(

                    switchMap((db: RxDatabase) => {

                        const collectionInfoKeyValue: {[key: string]: SynchroniseDocType} = m.collectionInfo.reduce((acc: Record<string, SynchroniseDocType>, cur: SynchroniseDocType) => {

                            acc[cur.collectionName] = cur;

                            return acc;

                        }, {});

                        const collections: Record<string, RxCollectionCreator> = {};
                        const collectionsExists: Record<string, RxCollection> = {};

                        m.collectionInfo.forEach(i => {

                            if (i.collectionName in db) {

                                collectionsExists[i.collectionName] = db[i.collectionName];

                                return;
                            }

                            const collectionOptions = JSON.parse(i.collectionOptions) as RxCollectionCreator;

                            collections[i.collectionName] = getCollectionCreator(
                                i.collectionName,
                                pwaCollectionMethods,
                                pwaDocMethods,
                                collectionOptions.attachments,
                                collectionOptions.options,
                                collectionOptions.migrationStrategies,
                                collectionOptions.autoMigrate
                            );
                        });

                        return (Object.keys(collections).length ? from(db.addCollections(collections)) : of({})).pipe(

                            map(v => ({...v, ...collectionsExists})),

                            map(v => Object.keys(v).map(k => ({
                                collection: v[k] as PwaCollection<any>,
                                ...collectionInfoKeyValue[k],
                            })))
                        );
                    })
                );

            }))),

            map(v => flatten(v)),

            tap((v: SynchroniseDocTypeExtras[]) =>  {

                v.forEach(docType => {

                    if (!docType?.collection?.hooks?.save?.pre?.series?.length) {

                        docType.collection.preSave((plainData, _) => {

                            // modify anyField before saving
                            plainData.createdAt = plainData.createdAt || new Date().getTime();
                            plainData.updatedAt = new Date().getTime();

                        }, false);
                    }

                });
            }),

            shareReplay(1),
        );
    }

    addSynchroniseDocument(data: SynchroniseDocType): Observable<SynchroniseDocument> {

        return this.collection$.pipe(

            switchMap(col => col.incrementalUpsert(data))
        );
    }

    /////////////////////////////
    // Synchronisation Management
    //////////////////////////////

    startSync() {

        this.retryChange.next(true);
    }

    stopSync() {

        this.retryChange.next(false);
    }

    unsynchronised(tenant: string, order: 'desc' | 'asc' = 'asc', checkIntervalTime=1000): Observable<PwaDocument<any>[]> {

        return this.storedCollections.pipe(

            // switchMap(v => interval(checkIntervalTime).pipe(

            //     startWith(null),

            //     map(() => v),
            // )),

            // concatMap(collectionsInfo => {

            //     const query = {
            //         selector: {
            //             matchUrl: {$regex: new RegExp(`^${tenant}.*`)},
            //             method: {$ne: 'GET'}
            //         }
            //     };

            //     const sortedDocs$ = collectionsInfo.map(k => from(k.collection.find(query).exec()));

            //     return from(sortedDocs$).pipe(

            //         mergeMap(docs$ => docs$),

            //         bufferCount(sortedDocs$.length),
            //     );

            // }),

            switchMap(collectionsInfo => {

                const query = {
                    selector: {
                        matchUrl: {$regex: new RegExp(`^${tenant}.*`)},
                        method: {$ne: 'GET'}
                    }
                };

                const sortedDocs$ = collectionsInfo.map(k => k.collection.find(query).$);

                return combineLatest(sortedDocs$);
            }),

            // auditTime(1000/60),

            map(sortedDocs => flatten(sortedDocs)),

            map((sortedDocs: PwaDocument<any>[]) => sortedDocs.sort((a, b) => order === 'asc' ? a.time - b.time : b.time - a.time)),

            enterZone<PwaDocument<any>[]>(this.config.ngZone),

            shareReplay(1),
        );
    }

    synchronise(tenant: string, unsynchronised$: Observable<PwaDocument<any>[]> = this.unsynchronised(tenant, 'asc')): Observable<PwaDocument<any> | boolean> {

        if (!this.config.httpClient) return empty();

        const hit$ = unsynchronised$.pipe(

            // map(sortedDocs => sortedDocs),

            filter(sortedDocs => sortedDocs.length > 0),

            map(sortedDocs => sortedDocs[0]),

            distinctUntilChanged((prev, cur) => prev.tenantUrl === cur.tenantUrl && prev.method === cur.method && prev.time === cur.time),

            // shareReplay(1),
        );

        const hit = () => hit$.pipe(

            concatMap((doc: PwaDocument<any>) => {

                try {

                    if (doc.method === 'POST') {

                        const url = doc.tenantUrl.split('____')[1].split('/');

                        url.splice(url.length - 1, 1);

                        let formData: FormData | {};

                        if (doc.fileFields.length) {

                            //////////////////
                            // Multipart/form
                            //////////////////

                            formData = createFormData(doc.toMutableJSON().data) as FormData;

                            doc.fileFields.forEach(k => {

                                (formData as FormData).delete(k.fileField);

                                (formData as FormData).delete(k.fileNameField);

                                (formData as FormData).delete(k.fileType);

                                if (k.fileKeyField && k.fileField && k.fileType) {

                                    (formData as FormData).delete(k.fileKeyField);

                                    (formData as FormData).append(k.fileKeyField, new File([new Uint8Array(JSON.parse(doc.data[k.fileField])).buffer], k.fileNameField || 'Unknown', {type: k.fileType}));
                                }
                            });

                        } else {

                            ////////////////////
                            // Application/json
                            ////////////////////

                            formData = doc.toMutableJSON().data;
                        }

                        const params = Object.keys(doc.toMutableJSON().params || {}).reduce((acc, cur) => {

                            acc = acc.set(cur, doc.params[cur]);

                            return acc;

                        }, new HttpParams());

                        const headers = Object.keys(doc.toMutableJSON().headers || {}).reduce((acc, cur) => {

                            acc = acc.set(cur, doc.headers[cur]);

                            return acc;

                        }, new HttpHeaders());

                        return (this.config.httpClient as HttpClient).post(url.join('/'), formData, {params, headers}).pipe(

                            switchMap(res => doc.incrementalPatch({
                                method: 'GET',
                                data: res,
                                error: null,
                                time: new Date().getTime()
                            })),

                            catchError(err => {

                                return from(doc.incrementalPatch({error: JSON.stringify(err)})).pipe(

                                    finalize(() => this.retryChange.next(false)),
                                );
                            }),

                        );

                    } else if (doc.method === 'PUT') {

                        let formData: FormData | {};

                        if (doc.fileFields.length) {

                            //////////////////
                            // Multipart/form
                            //////////////////

                            formData = createFormData(doc.toMutableJSON().data) as FormData;

                            doc.fileFields.forEach(k => {

                                (formData as FormData).delete(k.fileField);

                                (formData as FormData).delete(k.fileNameField);

                                (formData as FormData).delete(k.fileType);

                                if (k.fileKeyField && k.fileField && k.fileType) {

                                    (formData as FormData).delete(k.fileKeyField);

                                    (formData as FormData).append(k.fileKeyField, new File([new Uint8Array(JSON.parse(doc.data[k.fileField])).buffer], k.fileNameField || 'Unknown', {type: k.fileType}));
                                }
                            });

                        } else {

                            ////////////////////
                            // Application/json
                            ////////////////////

                            formData = doc.toMutableJSON().data;
                        }

                        const params = Object.keys(doc.toMutableJSON().params || {}).reduce((acc, cur) => {

                            acc = acc.set(cur, doc.params[cur]);

                            return acc;

                        }, new HttpParams());

                        const headers = Object.keys(doc.toMutableJSON().headers || {}).reduce((acc, cur) => {

                            acc = acc.set(cur, doc.headers[cur]);

                            return acc;

                        }, new HttpHeaders());

                        return (this.config.httpClient as HttpClient).put(doc.tenantUrl.split('____')[1], formData, {params, headers}).pipe(

                            switchMap(res => doc.incrementalPatch({
                                method: 'GET',
                                data: res,
                                error: null,
                                time: new Date().getTime()
                            })),

                            catchError(err => {

                                return from(doc.incrementalPatch({error: JSON.stringify(err)})).pipe(

                                    finalize(() => this.retryChange.next(false)),
                                );
                            }),

                        );

                    } else if (doc.method === 'DELETE') {

                        const params = Object.keys(doc.toMutableJSON().params || {}).reduce((acc, cur) => {

                            acc = acc.set(cur, doc.params[cur]);

                            return acc;

                        }, new HttpParams());

                        const headers = Object.keys(doc.toMutableJSON().headers || {}).reduce((acc, cur) => {

                            acc = acc.set(cur, doc.headers[cur]);

                            return acc;

                        }, new HttpHeaders());

                        return (this.config.httpClient as HttpClient).delete(doc.tenantUrl.split('____')[1], {params, headers}).pipe(

                            switchMap(() => doc.incrementalRemove()),

                            catchError(err => {

                                return from(doc.incrementalPatch({error: JSON.stringify(err)})).pipe(

                                    finalize(() => this.retryChange.next(false)),
                                );
                            }),

                        );
                    }

                } catch(e) {

                    console.log(e);
                }

                // console.error(`Document doesn\'t have valid method. Document: ${JSON.stringify(doc?.toMutableJSON())}`);

                return of(null);
            }),

            catchError(err => {

                // console.error(err);

                return of(null);
            })

        );

        return this.retryChange.asObservable().pipe(

            switchMap(trigger => trigger ? hit() : empty()),

        ) as Observable<boolean | PwaDocument<any>>;

    }

    ////////////////////////
    // Evict Management
    ////////////////////////

    evict(): Observable<any> {

        return this.storedCollections.pipe(

            take(1),

            switchMap(collectionInfo => {

                const evicts = collectionInfo.map(k => {

                    const cacheAllowedAge = new Date().getTime() - (k.collectionEvictTime * 1000);

                    return k.collection.insert$.pipe(

                        switchMap(() => k.collection.find({selector: {$and: [{method: {$eq: 'GET'}}, {time: {$lt: cacheAllowedAge}}]}}).remove())
                    );

                });

                return combineLatest(evicts);
            }),
        );

    }

    skipTrim(): Observable<any> {

        return this.storedCollections.pipe(

            take(1),

            switchMap((collectionInfo) => {

                const skipTrims = collectionInfo.map(k => {

                    return k.collection.insert$.pipe(

                        switchMap(() => k.collection.find({selector: {method: {$eq: 'GET'}}, sort: [{time: 'desc'}], skip: k.collectionSkipDocuments}).remove())
                    );
                });

                return combineLatest(skipTrims);
            }),
        );
    }

    ////////////////////////
    // Conflict Management
    ////////////////////////

    createNew(doc: PwaDocument<any>): Observable<PwaDocument<any>> {

        if (!!doc && doc.method !== 'GET' && doc.method !== 'POST') {

            return from(doc.incrementalPatch({method: 'POST', error: null}));
        }

        return throwError(`Cannot duplicate this document. Document: ${JSON.stringify(doc?.toMutableJSON() || {})}`);
    }

    deleteConflict(doc: PwaDocument<any>): Observable<PwaDocument<any>> {

        if (!!doc && doc.method !== 'GET') {

            return from(doc.incrementalRemove());
        }

        return throwError(`Cannot delete this document. Document: ${JSON.stringify(doc?.toMutableJSON() || {})}`);
    }
}
