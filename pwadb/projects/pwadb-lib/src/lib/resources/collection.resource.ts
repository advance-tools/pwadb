import { Datatype, FileConfig, getSchema, pwaDocMethods, PwaDocType, PwaDocument } from '../definitions/document';
import { getCollectionCreator, PwaCollection, pwaCollectionMethods, ListResponse, PwaListResponse, CollectionListResponse } from '../definitions/collection';
import { switchMap, map, catchError, shareReplay, tap, finalize, startWith, take, auditTime } from 'rxjs/operators';
import { Observable, of, from, throwError, combineLatest } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { queryFilter } from './filters.resource';
import { RxDatabase } from 'rxdb';
import { NgZone } from '@angular/core';
import { enterZone } from './operators.resource';
import { ApiProgressService } from './apiProgress.resource';
import { SyncCollectionService } from './synchronise-collection.resource';
import { SynchroniseDocType } from '../definitions/synchronise-document';
import { CustomHttpParams } from './customParams.resource';


export interface RestAPICreator {
    apiProgress?: ApiProgressService;
    httpClient?: HttpClient;
}


export interface CollectionAPICreator<Database> {
    name?: string;
    db$?: Observable<RxDatabase<Database>>;
    collectionEvictTime$: Observable<number>;
    collectionSkipDocuments$: Observable<number>;
    synchroniseService?: SyncCollectionService;
    attachments?: {};
    options?: {};
    migrationStrategies?: {};
    autoMigrate?: boolean;
    ngZone: NgZone;
}


export interface PwaCollectionAPICreator<Database> {
    collectionApiCreator: Partial<CollectionAPICreator<Database>>;
    restApiCreator: Partial<RestAPICreator>;
    cacheTimeInSeconds: number;
}


export class RestAPI<T extends Datatype> {

    private cache: Map<string, Observable<T> | Observable<ListResponse<T>>> = new Map();

    constructor(private config: RestAPICreator) {}

    ////////////////
    // CRUD
    ////////////////

    get(url: string, params?: HttpParams): Observable<T> {

        const paramsUrl = params?.keys().map(k => `${k}=${params.getAll(k).join(',')}`).join('&');

        const cacheKey = `${url}${paramsUrl ? '?' + paramsUrl : ''}`;

        const req = of(true).pipe(

            tap(() => { if (!!this.config.apiProgress) { this.config.apiProgress.add(); } }),

            switchMap(() => this.config.httpClient.get(cacheKey)),

            finalize(() => {

                if (!!this.config.apiProgress) { this.config.apiProgress.remove(); }

                if (this.cache.has(cacheKey)) { this.cache.delete(cacheKey); }

            }),

            shareReplay(1),

        ) as Observable<T>;

        if (!this.cache.has(cacheKey)) { this.cache.set(cacheKey, req); }

        return this.cache.get(cacheKey) as Observable<T>;
    }

    post(url: string, data: Partial<T> | FormData): Observable<T> {

        const cacheKey = url;

        const req = of(true).pipe(

            tap(() => { if (!!this.config.apiProgress) { this.config.apiProgress.add(); } }),

            switchMap(() => this.config.httpClient.post(url, data)),

            finalize(() => {

                if (!!this.config.apiProgress) { this.config.apiProgress.remove(); }

                if (this.cache.has(cacheKey)) { this.cache.delete(cacheKey); }
            }),

            shareReplay(1),

        )  as Observable<T>;

        if (!this.cache.has(cacheKey)) { this.cache.set(cacheKey, req); }

        return this.cache.get(cacheKey) as Observable<T>;
    }

    put(url: string, data: Partial<T> | FormData): Observable<T> {

        const cacheKey = url;

        const req = of(true).pipe(

            tap(() => { if (!!this.config.apiProgress) { this.config.apiProgress.add(); } }),

            switchMap(() => this.config.httpClient.put(url, data)),

            finalize(() => {

                if (!!this.config.apiProgress) { this.config.apiProgress.remove(); }

                if (this.cache.has(cacheKey)) { this.cache.delete(cacheKey); }
            }),

            shareReplay(1),

        ) as Observable<T>;

        if (!this.cache.has(cacheKey)) { this.cache.set(cacheKey, req); }

        return this.cache.get(cacheKey) as Observable<T>;
    }

    list(url: string, params?: HttpParams): Observable<ListResponse<T>> {

        const paramsUrl = params?.keys().map(k => `${k}=${params.getAll(k).join(',')}`).join('&');

        const cacheKey = `${url}${paramsUrl ? '?' + paramsUrl : ''}`;

        const req = of(true).pipe(

            tap(() => { if (!!this.config.apiProgress) { this.config.apiProgress.add(); } }),

            switchMap(() => this.config.httpClient.get(cacheKey)),

            finalize(() => {

                if (!!this.config.apiProgress) { this.config.apiProgress.remove(); }

                if (this.cache.has(cacheKey)) { this.cache.delete(cacheKey); }
            }),

            shareReplay(1),

        ) as Observable<ListResponse<T>>;

        if (!this.cache.has(cacheKey)) { this.cache.set(cacheKey, req); }

        return this.cache.get(cacheKey) as Observable<ListResponse<T>>;
    }

    delete(url: string): Observable<any> {

        const cacheKey = url;

        const req = of(true).pipe(

            tap(() => { if (!!this.config.apiProgress) { this.config.apiProgress.add(); } }),

            switchMap(() => this.config.httpClient.delete(url)),

            finalize(() => {

                if (!!this.config.apiProgress) { this.config.apiProgress.remove(); }

                if (this.cache.has(cacheKey)) { this.cache.delete(cacheKey); }
            }),

            shareReplay(1),

        ) as Observable<any>;

        if (!this.cache.has(cacheKey)) { this.cache.set(cacheKey, req); }

        return this.cache.get(cacheKey);
    }
}


export class CollectionAPI<T extends Datatype, Database> {

    private config: CollectionAPICreator<Database> = {
        name: 'no_name_collection_api',
        db$: of(),
        collectionEvictTime$: of(86400),
        collectionSkipDocuments$: of(500),
        attachments: {},
        options: {},
        migrationStrategies: {},
        autoMigrate: true,
        ngZone: null
    };

    // tslint:disable-next-line: variable-name
    private _collection$: Observable<PwaCollection<T>>;

    private cache = new Map();

    constructor(private _config: Partial<CollectionAPICreator<Database>>) {

        this.config = {
            ...this.config,
            ...this._config
        };
    }

    get collection$(): Observable<PwaCollection<T>> {

        if (this._collection$) { return this._collection$; }

        const collectionSchema = {};

        collectionSchema[this.config.name] = getCollectionCreator(
            this.config.name,
            pwaCollectionMethods,
            pwaDocMethods,
            this.config.attachments,
            this.config.options,
            this.config.migrationStrategies,
            this.config.autoMigrate
        );

        this._collection$ = this.config.db$.pipe(

            switchMap(db => {

                if (this.config.name in db) { return of(db[this.config.name]); }

                return combineLatest([
                    from(db.addCollections(collectionSchema)),
                    this.config.collectionEvictTime$,
                    this.config.collectionSkipDocuments$
                ]).pipe(

                    take(1),

                    switchMap(([collections, collectionEvictTime, collectionSkipDocuments]) => {

                        if (this.config.synchroniseService) {

                            const data: SynchroniseDocType = {
                                id: db.name + '-' + this.config.name,
                                databaseOptions: JSON.stringify({
                                    adapter: db.adapter,
                                    name: db.name,
                                    eventReduce: db.eventReduce,
                                    multiInstance: db.multiInstance,
                                    options: db.options,
                                    password: db.password,
                                    pouchSettings: db.pouchSettings
                                }),
                                collectionEvictTime,
                                collectionSkipDocuments,
                                collectionName: this.config.name,
                                collectionOptions: JSON.stringify({
                                    name: this.config.name,
                                    schema: getSchema(this.config.name),
                                    attachments: collections[this.config.name].attachments,
                                    autoMigrate: true,
                                    cacheReplacementPolicy: collections[this.config.name].cacheReplacementPolicy,
                                    methods: collections[this.config.name].methods,
                                    migrationStrategies: collections[this.config.name].migrationStrategies,
                                    options: collections[this.config.name].options,
                                    pouchSettings: collections[this.config.name].pouchSettings,
                                    statics: collections[this.config.name].statics,
                                })
                            };

                            // add collection to synchronise collection service
                            return this.config.synchroniseService.addSynchroniseDocument(data).pipe(

                                map(() => collections[this.config.name] as PwaCollection<T>)
                            );

                        } else {

                            return of(collections).pipe(

                                map(() => collections[this.config.name] as PwaCollection<T>)
                            );
                        }

                    })
                );
            }),

            tap(col => col.preSave((plainData, rxDocument) => {

                // modify anyField before saving
                // add hook in synchronise-collection as well
                plainData.createdAt = plainData.createdAt || new Date().getTime();
                plainData.updatedAt = new Date().getTime();

            }, false)),

            shareReplay(1),

            take(1),
        );

        return this._collection$;
    }

    makeTenantUrl(tenant: string, url: string): string {

        return `${tenant}____${url}`;
    }

    filterDocs(
        docs: Observable<PwaDocument<T>[]>,
        url: string,
        params?: HttpParams,
        validQueryKeys = []
    ): Observable<CollectionListResponse<T>> {

        return docs.pipe(

            // map(v => v.sort((a, b) => b.time - a.time)),

            map(allDocs => queryFilter(validQueryKeys, params, allDocs)),

            map(allDocs => {

                // tslint:disable-next-line: radix
                const start = parseInt(params?.get('offset') || '0');

                // tslint:disable-next-line: radix
                const end = start + parseInt(params?.get('limit') || '100');

                const next = allDocs.length - end > 0 ? `${url}?${params.set('offset', end.toString()).toString()}` : null;

                const previous = start > 0 ? `${url}?${params.set('offset', start.toString()).toString()}` : null;

                return {next, previous, results: allDocs.slice(start, end), count: allDocs.length};
            }),

        );
    }

    ////////////////
    // CRUD
    ////////////////

    getReactive(tenant: string, url: string): Observable<PwaDocument<T>> {

        const cacheKey = tenant + url;

        if (!this.cache.has(cacheKey)) {

            const doc = this.collection$.pipe(

                switchMap(col => col.findOne({selector: { tenantUrl: {$eq: this.makeTenantUrl(tenant, url)}}}).$),

                shareReplay(1),

                enterZone<PwaDocument<T>>(this.config.ngZone),
            );

            this.cache.set(cacheKey, doc);
        }

        return this.cache.get(cacheKey);

    }

    get(tenant: string, url: string): Observable<PwaDocument<T>> {

        return this.getReactive(tenant, url).pipe(

            take(1),
        );
    }

    listReactive(tenant: string, url: string, params?: HttpParams, validQueryKeys = []): Observable<CollectionListResponse<T>> {

        const cacheKey = tenant + url;

        if (!this.cache.has(cacheKey)) {

            const docs = this.collection$.pipe(

                switchMap(col => col.find({ selector: {matchUrl: {$regex: new RegExp(`^${this.makeTenantUrl(tenant, url)}.*`)}} }).$),

                shareReplay(1),
            );

            this.cache.set(cacheKey, docs);
        }

        return this.filterDocs(this.cache.get(cacheKey), url, params, validQueryKeys).pipe(

            enterZone<CollectionListResponse<T>>(this.config.ngZone),
        );
    }

    list(tenant: string, url: string, params?: HttpParams, validQueryKeys = []): Observable<CollectionListResponse<T>> {

        return this.listReactive(tenant, url, params, validQueryKeys).pipe(

            take(1)
        );
    }

    /////////////
    // Actions
    /////////////

    post(tenant: string, url: string, data: T, fileFields: FileConfig[] = []): Observable<PwaDocument<T>> {

        return this.collection$.pipe(

            switchMap(col => col.atomicUpsert({
                tenantUrl: `${this.makeTenantUrl(tenant, url)}/${data.id}`,
                matchUrl: `${this.makeTenantUrl(tenant, url)}/${data.id}`,
                method: 'POST',
                data,
                error: null,
                time: new Date().getTime(),
                fileFields
            })),
        );
    }

    put(tenant: string, url: string, data: T, fileFields: FileConfig[] = []): Observable<PwaDocument<T>> {

        return combineLatest([this.get(tenant, url), this.collection$]).pipe(

            switchMap(([doc, col]) => {

                if (doc) {

                    return doc.atomicPatch({
                        method: doc.method !== 'POST' ? 'PUT' : doc.method,
                        data,
                        error: null,
                        time: doc.method === 'GET' ? new Date().getTime() : doc.time,
                        fileFields
                    });

                } else {

                    const docData: Partial<PwaDocType<T>> = {
                        tenantUrl: this.makeTenantUrl(tenant, url),
                        matchUrl: this.makeTenantUrl(tenant, url),
                        data,
                        method: 'PUT',
                        error: null,
                        time: new Date().getTime(),
                    };

                    return col.atomicUpsert(docData);
                }

            }),
        );
    }

    delete(tenant: string, url: string): Observable<boolean | PwaDocument<T>> {

        return this.get(tenant, url).pipe(

            switchMap(doc => {

                if (!!doc && doc.method === 'POST') {

                    return from(doc.remove());

                } else if (!!doc && (doc.method === 'PUT' || doc.method === 'DELETE')) {

                    return from(doc.atomicPatch({method: 'DELETE', error: null}));

                }  else if (!!doc) {

                    return from(doc.atomicPatch({method: 'DELETE', error: null, time: new Date().getTime()}));

                } else {

                    return throwError('Document not found while deleting in database');
                }

            })
        );
    }

    ///////////////////
    // Conflict Actions
    ///////////////////

    createNew(tenant: string, url: string): Observable<PwaDocument<T>> {

        return this.get(tenant, url).pipe(

            switchMap(doc => {

                if (!!doc && doc.method !== 'GET' && doc.method !== 'POST') {

                    return from(doc.atomicUpdate(oldDoc => {

                        oldDoc.method = 'POST';

                        return oldDoc;

                    }));
                }

                return throwError(`Cannot duplicate this document. Document: ${JSON.stringify(doc?.toJSON() || {})}`);
            })
        );
    }

    deleteConflict(tenant: string, url: string): Observable<boolean> {

        return this.get(tenant, url).pipe(

            switchMap(doc => {

                if (!!doc && doc.method !== 'GET') {

                    return from(doc.remove());
                }

                return throwError(`Cannot delete this document. Document: ${JSON.stringify(doc?.toJSON() || {})}`);
            })
        );
    }
}


export class PwaCollectionAPI<T extends Datatype, Database> {

    private config: PwaCollectionAPICreator<Database> = {
        restApiCreator: {},
        collectionApiCreator: {
            name: 'no_name_pwa_collection_api',
            db$: of(),
            collectionEvictTime$: of(86400),
            collectionSkipDocuments$: of(500),
            attachments: {},
            options: {},
            migrationStrategies: {},
            autoMigrate: true,
        },
        cacheTimeInSeconds: 120
    };

    collectionAPI: CollectionAPI<T, Database>;
    restAPI: RestAPI<T>;

    constructor(private _config: Partial<PwaCollectionAPICreator<Database>>, ) {

        this.config = {
            ...this.config,
            ...this._config,
            restApiCreator: {
                ...this.config.restApiCreator,
                ...this._config.restApiCreator
            },
            collectionApiCreator: {
                ...this.config.collectionApiCreator,
                ...this._config.collectionApiCreator
            }
        };

        this.restAPI        = new RestAPI(this.config.restApiCreator);
        this.collectionAPI  = new CollectionAPI(this.config.collectionApiCreator);
    }

    //////////////
    // Retrieve
    //////////////

    downloadRetrieve(doc: PwaDocument<T> | null, tenant: string, url: string, params?: HttpParams): Observable<PwaDocument<T> | null> {

        if (!!doc && doc.method !== 'GET') { return of(doc); }

        // check if document is within cacheTime
        const currentTime = new Date().getTime();

        if (!!doc && doc.time >= (currentTime - (this.config.cacheTimeInSeconds * 1000))) { return of(doc); }

        return combineLatest([this.restAPI.get(url, params), this.collectionAPI.collection$]).pipe(

            switchMap(([res, col]) => col.atomicUpsert({
                tenantUrl: this.collectionAPI.makeTenantUrl(tenant, url),
                matchUrl: this.collectionAPI.makeTenantUrl(tenant, url),
                data: res,
                method: 'GET',
                error: null,
                time: new Date().getTime(),
            })),

            catchError(() => of(doc)),
        );
    }

    getReactive(tenant: string, url: string, params?: HttpParams, wait = false): Observable<PwaDocument<T>> {

        return this.collectionAPI.get(tenant, url).pipe(

            switchMap(doc => wait ?
                this.downloadRetrieve(doc, tenant, url, params) :
                this.downloadRetrieve(doc, tenant, url, params).pipe(startWith(null))
            ),

            switchMap(() => this.collectionAPI.getReactive(tenant, url)),

            auditTime(1000 / 60),

        );
    }

    get(tenant: string, url: string, params?: HttpParams): Observable<PwaDocument<T>> {

        return this.getReactive(tenant, url, params, true).pipe(

            take(1)
        );
    }

    //////////////
    // List
    //////////////

    // tslint:disable-next-line: max-line-length
    downloadList(res: CollectionListResponse<T>, tenant: string, url: string, params?: HttpParams, indexedbUrl = (data: T, tenantUrl: string) => `${tenantUrl}/${data.id}`): Observable<ListResponse<T>> {

        const currentTime = new Date().getTime();

        // tslint:disable-next-line: radix
        const limit = parseInt(params?.get('limit') || '100');

        ////////////////////////////////////////////////////////////////
        // Exclude recents or locally unsynced data in the api results
        ////////////////////////////////////////////////////////////////

        const ids = res.results
            // tslint:disable-next-line: max-line-length
            .filter(v => v.method === 'PUT' || v.method === 'DELETE' || (v.method === 'GET' && v.time >= (currentTime - (this.config.cacheTimeInSeconds * 1000))))
            .map(v => v.data.id);

        if (ids.length === limit) {

            // pass if all results are excluded
            return of({next: res.next, previous: res.previous, results: /*res.results.map(r => r.toJSON().data)*/ []});
        }

        params = params || new CustomHttpParams();

        if (ids.length > 0) {

            if (params.has('exclude:id.in')) {

                params.delete('exclude:id.in');

            }

            params = params.append('exclude:id.in', ids.join(','));

            params = params.set('limit', (limit - ids.length).toString());

        }

        return this.restAPI.list(url, params).pipe(

            catchError(() => of({next: null, previous: null, results: []} as ListResponse<T>)),

            switchMap(networkRes => this.collectionAPI.collection$.pipe(

                switchMap(col => {

                    // map network data to doctype
                    const atomicWrites = networkRes.results
                        .map(data => ({
                            tenantUrl: indexedbUrl(data, this.collectionAPI.makeTenantUrl(tenant, url)),
                            matchUrl: indexedbUrl(data, this.collectionAPI.makeTenantUrl(tenant, url)),
                            data,
                            method: 'GET',
                            error: null,
                            time: new Date().getTime(),
                        })) as PwaDocType<T>[];

                    if (atomicWrites.length > 0) {

                        return from(col.bulkInsert(atomicWrites)).pipe(

                            // tap(() => this.collectionAPI.triggerChange()),

                            map(() => networkRes)
                        );
                    }

                    return of(networkRes);
                })
            )),

        );

    }

    listReactive(
        tenant: string,
        url: string,
        params?: HttpParams,
        validQueryKeys = [],
        indexedbUrl = (data: T, tenantUrl: string) => `${tenantUrl}/${data.id}`,
        wait = false
    ): Observable<PwaListResponse<T>> {

        return this.collectionAPI.list(tenant, url, params, validQueryKeys).pipe(

            switchMap(idbRes => wait ?
                this.downloadList(idbRes, tenant, url, params, indexedbUrl) :
                this.downloadList(idbRes, tenant, url, params, indexedbUrl).pipe(startWith({next: null, previous: null, results: []}))),

            switchMap((networkRes) => this.collectionAPI.listReactive(tenant, url, params, validQueryKeys).pipe(

                map(res => ({
                    next: networkRes?.next || res.next,
                    previous: networkRes?.previous || res.previous,
                    results: res.results
                })),

            )),

        ) as Observable<PwaListResponse<T>>;

    }

    list(tenant: string, url: string, params?: HttpParams, validQueryKeys = [], indexedbUrl = (data: T, tenantUrl: string) => `${tenantUrl}/${data.id}`): Observable<PwaListResponse<T>> {

        return this.listReactive(tenant, url, params, validQueryKeys, indexedbUrl, true).pipe(

            take(1)
        );

    }
}
