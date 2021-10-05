import { HttpClient } from '@angular/common/http';
import { NgZone } from '@angular/core';
import { RxCollectionCreator, RxDatabase } from 'rxdb';
import { BehaviorSubject, combineLatest, from, Observable, of, throwError } from 'rxjs';
import { auditTime, catchError, concatMap, filter, finalize, first, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { getCollectionCreator, PwaCollection, pwaCollectionMethods } from '../definitions/collection';
import { pwaDocMethods, PwaDocument } from '../definitions/document';
import { getSynchroniseCollectionCreator, SynchroniseCollection, synchroniseCollectionMethods } from '../definitions/synchronise-collection';
import { synchroniseDocMethods, SynchroniseDocType, SynchroniseDocument } from '../definitions/synchronise-document';
import { enterZone } from './operators.resource';
import { PwaDatabaseService } from './database.resource';

interface Extras {
    collection: PwaCollection<any>;
}

type SynchroniseDocTypeExtras = SynchroniseDocType & Extras;


export interface SyncCollectionServiceCreator {
    name: string;
    db$: Observable<RxDatabase<any>>;
    attachments?: {};
    options?: {};
    migrationStrategies?: {};
    autoMigrate?: boolean;
    ngZone: NgZone;
    httpClient: HttpClient;
}


export class SyncCollectionService {

    // tslint:disable-next-line: variable-name
    private _collection$: Observable<SynchroniseCollection>;

    private retryChange: BehaviorSubject<boolean>;

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

        this.retryChange = new BehaviorSubject(true);

        this.storedCollections = this.collection$.pipe(

            switchMap(col => col.find().$),

            map(docs => docs.map(d => d.toJSON())),

            map(docTypes => {

                // reduce collections to database wise
                const databasesSchema: {[key: string]: SynchroniseDocType[]} = {};

                docTypes.forEach(d => {

                    const key = d.databaseOptions;

                    key in databasesSchema ? databasesSchema[key].push(d) : databasesSchema[key] = [d];
                });

                // map RxDatabase and collectionNames

                const databasesMap: {database: Observable<RxDatabase>, collectionInfo: SynchroniseDocType[]}[] = [];

                Object.keys(databasesSchema).forEach(schema => {

                    const pwaDatabaseService = new PwaDatabaseService<any>({dbCreator: {...JSON.parse(schema), ignoreDuplicate: true}});

                    databasesMap.push({database: pwaDatabaseService.db$, collectionInfo: databasesSchema[schema]});
                });

                return databasesMap;
            }),

            switchMap(databasesMap => combineLatest(databasesMap.map(m => {

                return m.database.pipe(

                    switchMap(db => {

                        const collectionInfoKeyValue: {[key: string]: SynchroniseDocType} = m.collectionInfo.reduce(
                            (cur: SynchroniseDocType, acc: {}) => {

                                acc[cur.collectionName] = cur;

                                return acc;

                            }, {});

                        const collections = {};

                        m.collectionInfo.forEach(i => {

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

                        return from(db.addCollections(collections)).pipe(

                            map(v => Object.keys(v).map(k => ({
                                collection: v[k] as PwaCollection<any>,
                                ...collectionInfoKeyValue[k],
                            })))
                        );
                    })
                );

            }))),

            map(v => [].concat(...v)),

            tap((v: SynchroniseDocTypeExtras[]) =>  {

                v.forEach(docType => {

                    docType.collection.preSave((plainData, rxDocument) => {

                        // modify anyField before saving
                        plainData.createdAt = plainData.createdAt || new Date().getTime();
                        plainData.updatedAt = new Date().getTime();

                    }, false);

                });
            }),

            shareReplay(1),
        );
    }

    get collection$(): Observable<SynchroniseCollection> {

        if (this._collection$) { return this._collection$; }

        const collectionSchema = {};

        collectionSchema[this.config.name] = getSynchroniseCollectionCreator(
            this.config.name,
            synchroniseCollectionMethods,
            synchroniseDocMethods,
            this.config.attachments,
            this.config.options,
            this.config.migrationStrategies,
            this.config.autoMigrate
        );

        this._collection$ = this.config.db$.pipe(

            // tslint:disable-next-line: max-line-length
            switchMap(db => from(db.addCollections(collectionSchema))),

            map(collections => collections[this.config.name]),

            shareReplay(1),

            first()
        );

        return this._collection$;
    }


    addSynchroniseDocument(data: SynchroniseDocType): Observable<SynchroniseDocument> {

        return this.collection$.pipe(

            switchMap(col => col.atomicUpsert(data))
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

    unsynchronised(tenant: string, order: 'desc' | 'asc' = 'asc'): Observable<PwaDocument<any>[]> {

        return this.storedCollections.pipe(

            switchMap((collectionsInfo) => {

                const query = {
                    selector: {
                        matchUrl: {$regex: new RegExp(`^${tenant}.*`)},
                        method: {$ne: 'GET'}
                    }
                };

                const sortedDocs$ = collectionsInfo.map(k => {

                    return from(k.collection.find(query).$.pipe(

                        auditTime(1000 / 60)
                    ));
                });

                return combineLatest(sortedDocs$);

            }),

            map(sortedDocs => [].concat(...sortedDocs)),

            // tslint:disable-next-line: max-line-length
            map((sortedDocs: PwaDocument<any>[]) => sortedDocs.sort((a, b) => order === 'asc' ? a.time - b.time : b.time - a.time)),

            enterZone<PwaDocument<any>[]>(this.config.ngZone),
        );
    }

    synchronise(tenant: string): Observable<PwaDocument<any> | boolean> {

        const pop: Observable<PwaDocument<any>> = this.unsynchronised(tenant, 'asc').pipe(

            filter(sortedDocs => sortedDocs.length > 0),

            map(sortedDocs => sortedDocs[0]),

        );

        const hit = pop.pipe(

            concatMap(doc => {

                if (doc.method === 'POST') {

                    const url = doc.tenantUrl.split('____')[1].split('/');

                    url.splice(url.length - 1, 1);

                    const formData = createFormData(doc.toJSON().data);

                    doc.fileFields.forEach(k => {

                        formData.delete(k.fileField);

                        formData.delete(k.fileNameField);

                        formData.delete(k.fileType);

                        if (k.fileKeyField && k.fileField && k.fileType) formData.set(k.fileKeyField, new File([new Uint8Array(JSON.parse(doc.data[k.fileField])).buffer], k.fileNameField || 'Unknown', {type: k.fileType}));
                    });

                    return this.config.httpClient.post(url.join('/'), formData).pipe(

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

                    const formData = createFormData(doc.toJSON().data);

                    doc.fileFields.forEach(k => {

                        formData.delete(k.fileField);

                        formData.delete(k.fileNameField);

                        formData.delete(k.fileType);

                        if (k.fileKeyField && k.fileField && k.fileType) formData.set(k.fileKeyField, new File([new Uint8Array(JSON.parse(doc.data[k.fileField])).buffer], k.fileNameField || 'Unknown', {type: k.fileType}));
                    });

                    return this.config.httpClient.put(doc.tenantUrl.split('____')[1], formData).pipe(

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

                    return this.config.httpClient.delete(doc.tenantUrl.split('____')[1]).pipe(

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

    evict(): Observable<any> {

        return this.storedCollections.pipe(

            switchMap(collectionInfo => {

                const evicts = collectionInfo.map(k => {

                    const cacheAllowedAge = new Date().getTime() - (k.collectionEvictTime * 1000);

                    return k.collection.insert$.pipe(

                        // tslint:disable-next-line: max-line-length
                        switchMap(() => k.collection.find({selector: {$and: [{method: {$eq: 'GET'}}, {time: {$lt: cacheAllowedAge}}]}}).remove())
                    );

                });

                return combineLatest(evicts);
            }),
        );

    }

    // tslint:disable-next-line: max-line-length
    skipTrim(): Observable<any> {

        return this.storedCollections.pipe(

            switchMap((collectionInfo) => {

                const skipTrims = collectionInfo.map(k => {

                    return k.collection.insert$.pipe(

                        // tslint:disable-next-line: max-line-length
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


export function createFormData(object: Object, form?: FormData, namespace?: string): FormData {

    const formData = form || new FormData();

    for (let property in object) {

        const formKey = namespace ? `${namespace}[${property}]` : property;

        if (object[property] instanceof Date) {

            formData.append(formKey, object[property].toISOString());

        } else if (typeof object[property] === 'object' && !(object[property] instanceof File)) {

            createFormData(object[property], formData, formKey);

        } else {

            formData.append(formKey, object[property] === null || object[property] === undefined ? '' : object[property]);
        }
    }

    return formData;
}
