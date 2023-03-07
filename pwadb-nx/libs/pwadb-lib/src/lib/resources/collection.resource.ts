import { Datatype, FileConfig, getSchema, pwaDocMethods, PwaDocType, PwaDocument } from '../definitions/document';
import { getCollectionCreator, PwaCollection, pwaCollectionMethods, ListResponse, PwaListResponse, CollectionListResponse } from '../definitions/collection';
import { switchMap, map, catchError, shareReplay, tap, finalize, startWith, take, auditTime, timeout } from 'rxjs/operators';
import { Observable, of, from, throwError, combineLatest, empty } from 'rxjs';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { queryFilter } from './filters.resource';
import { MangoQuery, RxCollectionCreator, RxDatabase } from 'rxdb';
import { NgZone } from '@angular/core';
import { enterZone } from './operators.resource';
import { ApiProgressService } from './apiProgress.resource';
import { SyncCollectionService } from './synchronise-collection.resource';
import { SynchroniseDocType } from '../definitions/synchronise-document';
import { CustomHttpParams } from './customParams.resource';


export interface RestAPICreator {
    apiProgress?: ApiProgressService;
    httpClient?: HttpClient;
    apiTimeoutInSeconds?: number;
}


export interface CollectionAPICreator<Database> {
    name: string;
    db$: Observable<RxDatabase<Database>>;
    collectionEvictTime$: Observable<number>;
    collectionSkipDocuments$: Observable<number>;
    synchroniseService?: SyncCollectionService;
    attachments?: {};
    options?: {};
    migrationStrategies?: {};
    autoMigrate?: boolean;
    ngZone: NgZone | null;
}


export interface PwaCollectionAPICreator<Database> {
    collectionApiCreator: Partial<CollectionAPICreator<Database>>;
    restApiCreator: Partial<RestAPICreator>;
    cacheTimeInSeconds: number;
}


export class RestAPI<T extends Datatype> {

    private cache: Map<string, Observable<T> | Observable<ListResponse<T>>> = new Map();

    constructor(private config: RestAPICreator) {}

    convertParams(params?: HttpParams): CustomHttpParams {

        let customHttpParams = new CustomHttpParams();

        params?.keys().forEach(k => {

            customHttpParams = customHttpParams.set(k, params.getAll(k)?.join(','));
        });

        return customHttpParams;
    }

    ////////////////
    // CRUD
    ////////////////

    get(url: string, params?: HttpParams, headers?: HttpHeaders): Observable<T> {

        params = this.convertParams(params);

        const paramsUrl = params?.keys().map(k => `${k}=${params.getAll(k)?.join(',')}`).join('&');

        const cacheKey = `${url}${paramsUrl ? '?' + paramsUrl : ''}`;

        const req = of(true).pipe(

            tap(() => { if (!!this.config.apiProgress) { this.config.apiProgress.add(); } }),

            // switchMap(() => this.config?.httpClient?.get(cacheKey, {headers}) as Observable<T> || empty()),
            switchMap(() => this.config?.httpClient?.get(url, {headers, params}) as Observable<T> || empty()),

            timeout((this.config.apiTimeoutInSeconds || 10) * 1000),

            finalize(() => {

                if (!!this.config.apiProgress) { this.config.apiProgress.remove(); }

                if (this.cache.has(cacheKey)) { this.cache.delete(cacheKey); }
            }),

            shareReplay(1),

        ) as Observable<T>;

        if (!this.cache.has(cacheKey)) { this.cache.set(cacheKey, req); }

        return this.cache.get(cacheKey) as Observable<T>;
    }

    post(url: string, data: Partial<T> | FormData, headers?: HttpHeaders): Observable<T> {

        const cacheKey = url;

        const req = of(true).pipe(

            tap(() => { if (!!this.config.apiProgress) { this.config.apiProgress.add(); } }),

            switchMap(() => this.config?.httpClient?.post(url, data, {headers}) as Observable<T> || empty()),

            finalize(() => {

                if (!!this.config.apiProgress) { this.config.apiProgress.remove(); }

                if (this.cache.has(cacheKey)) { this.cache.delete(cacheKey); }
            }),

            shareReplay(1),

        )  as Observable<T>;

        if (!this.cache.has(cacheKey)) { this.cache.set(cacheKey, req); }

        return this.cache.get(cacheKey) as Observable<T>;
    }

    put(url: string, data: Partial<T> | FormData, headers?: HttpHeaders): Observable<T> {

        const cacheKey = url;

        const req = of(true).pipe(

            tap(() => { if (!!this.config.apiProgress) { this.config.apiProgress.add(); } }),

            switchMap(() => this.config?.httpClient?.put(url, data, {headers}) as Observable<T> || empty()),

            finalize(() => {

                if (!!this.config.apiProgress) { this.config.apiProgress.remove(); }

                if (this.cache.has(cacheKey)) { this.cache.delete(cacheKey); }
            }),

            shareReplay(1),

        ) as Observable<T>;

        if (!this.cache.has(cacheKey)) { this.cache.set(cacheKey, req); }

        return this.cache.get(cacheKey) as Observable<T>;
    }

    list(url: string, params?: HttpParams, headers?: HttpHeaders): Observable<ListResponse<T>> {

        params = this.convertParams(params);

        const paramsUrl = params?.keys().map(k => `${k}=${params?.getAll(k)?.join(',')}`).join('&');

        const cacheKey = `${url}${paramsUrl ? '?' + paramsUrl : ''}`;

        const req = of(true).pipe(

            tap(() => { if (!!this.config.apiProgress) { this.config.apiProgress.add(); } }),

            // switchMap(() => this.config?.httpClient?.get(cacheKey, {headers}) as Observable<ListResponse<T>> || empty()),
            switchMap(() => this.config?.httpClient?.get(url, {headers, params}) as Observable<ListResponse<T>> || empty()),

            timeout((this.config.apiTimeoutInSeconds || 10) * 1000),

            finalize(() => {

                if (!!this.config.apiProgress) { this.config.apiProgress.remove(); }

                if (this.cache.has(cacheKey)) { this.cache.delete(cacheKey); }
            }),

            shareReplay(1),

        ) as Observable<ListResponse<T>>;

        if (!this.cache.has(cacheKey)) { this.cache.set(cacheKey, req); }

        return this.cache.get(cacheKey) as Observable<ListResponse<T>>;
    }

    delete(url: string, headers?: HttpHeaders): Observable<any> {

        const cacheKey = url;

        const req = of(true).pipe(

            tap(() => { if (!!this.config.apiProgress) { this.config.apiProgress.add(); } }),

            switchMap(() => this.config?.httpClient?.delete(url, {headers}) as Observable<any> || empty()),

            finalize(() => {

                if (!!this.config.apiProgress) { this.config.apiProgress.remove(); }

                if (this.cache.has(cacheKey)) { this.cache.delete(cacheKey); }
            }),

            shareReplay(1),

        ) as Observable<any>;

        if (!this.cache.has(cacheKey)) { this.cache.set(cacheKey, req); }

        return this.cache.get(cacheKey) as Observable<any>;
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

    collection$: Observable<PwaCollection<T>>;

    private cache = new Map();

    constructor(private _config: Partial<CollectionAPICreator<Database>>) {

        this.config = {
            ...this.config,
            ...this._config
        };

        const collectionSchema: Record<string, RxCollectionCreator> = {};

        collectionSchema[this.config?.name] = getCollectionCreator(
            this.config?.name,
            pwaCollectionMethods,
            pwaDocMethods,
            this.config.attachments,
            this.config.options,
            this.config.migrationStrategies,
            this.config.autoMigrate
        );

        this.collection$ = this.config.db$.pipe(

            switchMap(db => {

                // if (this.config.name in db) { return of(db[this.config.name]); }

                const cacheCollections = {};

                this.config.name in db ? cacheCollections[this.config.name] = db[this.config.name] : null;

                return combineLatest([
                    this.config.name in db ? of(cacheCollections) : db.addCollections(collectionSchema),
                    this.config.collectionEvictTime$,
                    this.config.collectionSkipDocuments$
                ]).pipe(

                    // take(1),

                    switchMap(([collections, collectionEvictTime, collectionSkipDocuments]) => {

                        if (this.config.synchroniseService) {

                            const data: SynchroniseDocType = {
                                id: db.name + '-' + this.config.name,
                                databaseOptions: JSON.stringify({
                                    name: db.name,
                                    eventReduce: db.eventReduce,
                                    multiInstance: db.multiInstance,
                                    options: db.options,
                                    password: db.password,
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

            // take(1),
        );
    }

    makeTenantUrl(tenant: string, url: string): string {

        return `${tenant}____${url}`;
    }

    filterDocs(
        docs: Observable<PwaDocument<T>[]>,
        url: string,
        params?: HttpParams,
        validQueryKeys: string[] = []
    ): Observable<CollectionListResponse<T>> {

        return docs.pipe(

            // map(v => v.sort((a, b) => b.time - a.time)),

            map(allDocs => queryFilter(validQueryKeys, params, allDocs)),

            map(allDocs => {

                const start = parseInt(params?.get('offset') || '0');

                const end = start + parseInt(params?.get('limit') || '100');

                const next = allDocs.length - end > 0 ? `${url}?${params?.set('offset', end.toString()).toString()}` : null;

                const previous = start > 0 ? `${url}?${params?.set('offset', start.toString()).toString()}` : null;

                return {next, previous, results: allDocs.slice(start, end), count: allDocs.length} as CollectionListResponse<T>;
            }),

            // distinctUntilChanged((prev, cur) => {

            //     const output = prev?.next === cur?.next && prev?.previous === cur?.previous && prev?.count === cur?.count && prev?.results.length === cur?.results.length;

            //     return output ? prev.results.map((p, i) => p === cur[i]).reduce((acc, cur) => acc && cur, true) : false;
            // })

        );
    }

    ////////////////
    // CRUD
    ////////////////

    getReactive(tenant: string, url: string): Observable<PwaDocument<T> | null> {

        const cacheKey = 'get__' + tenant + url;

        if (!this.cache.has(cacheKey)) {

            const doc = this.collection$.pipe(

                switchMap(col => col.findOne({selector: { tenantUrl: {$eq: this.makeTenantUrl(tenant, url)}}} as MangoQuery<PwaDocType<T>>).$),

                auditTime(1000 / 60),

                // shareReplay(1),

                enterZone<PwaDocument<T> | null>(this.config.ngZone),

            ) as Observable<PwaDocument<T> | null>;

            this.cache.set(cacheKey, doc);
        }

        return this.cache.get(cacheKey);
    }

    get(tenant: string, url: string): Observable<PwaDocument<T> | null> {

        return this.getReactive(tenant, url).pipe(

            take(1),
        );
    }

    listReactive(tenant: string, url: string, params?: HttpParams, validQueryKeys: string[] = []): Observable<CollectionListResponse<T>> {

        const cacheKey = 'list__' + tenant + url;

        if (!this.cache.has(cacheKey)) {

            const docs = this.collection$.pipe(

                switchMap(col => col.find({ selector: {matchUrl: {$regex: new RegExp(`^${this.makeTenantUrl(tenant, url)}.*`)}} } as MangoQuery<PwaDocType<T>>).$),

                auditTime(1000 / 60),

                // shareReplay(1),
            );

            this.cache.set(cacheKey, docs);
        }

        return this.filterDocs(this.cache.get(cacheKey), url, params, validQueryKeys).pipe(

            enterZone<CollectionListResponse<T>>(this.config.ngZone),
        );
    }

    list(tenant: string, url: string, params?: HttpParams, validQueryKeys: string[] = []): Observable<CollectionListResponse<T>> {

        return this.listReactive(tenant, url, params, validQueryKeys).pipe(

            take(1)
        );
    }

    /////////////
    // Actions
    /////////////

    post(tenant: string, url: string, data: T, fileFields: FileConfig[] = [], params?: HttpParams, headers?: HttpHeaders): Observable<PwaDocument<T>> {

        return this.collection$.pipe(

            switchMap(col => col.incrementalUpsert({
                tenantUrl: `${this.makeTenantUrl(tenant, url)}/${data.id}`,
                matchUrl: `${this.makeTenantUrl(tenant, url)}/${data.id}`,
                method: 'POST',
                data,
                error: null,
                time: new Date().getTime(),
                fileFields,
                params: params?.keys().reduce((acc, cur) => {

                    acc[cur] = params.getAll(cur).join(',')

                    return acc;

                }, {}) || null,
                headers: headers?.keys().reduce((acc, cur) => {

                    acc[cur] = headers.getAll(cur).join(',')

                    return acc;

                }, {}) || null,
            })),
        );
    }

    put(tenant: string, url: string, data: T, fileFields: FileConfig[] = [], params?: HttpParams, headers?: HttpHeaders): Observable<PwaDocument<T>> {

        return combineLatest([this.get(tenant, url), this.collection$]).pipe(

            switchMap(([doc, col]) => {

                if (doc) {

                    return doc.incrementalPatch({
                        method: doc.method !== 'POST' ? 'PUT' : doc.method,
                        data,
                        error: null,
                        time: doc.method === 'GET' ? new Date().getTime() : doc.time,
                        fileFields,
                        params: params?.keys().reduce((acc, cur) => {

                            acc[cur] = params.getAll(cur).join(',')

                            return acc;

                        }, {}) || null,
                        headers: headers?.keys().reduce((acc, cur) => {

                            acc[cur] = headers.getAll(cur).join(',')

                            return acc;

                        }, {}) || null,
                    });

                } else {

                    const docData: Partial<PwaDocType<T>> = {
                        tenantUrl: this.makeTenantUrl(tenant, url),
                        matchUrl: this.makeTenantUrl(tenant, url),
                        data,
                        method: 'PUT',
                        error: null,
                        time: new Date().getTime(),
                        fileFields,
                        params: params?.keys().reduce((acc, cur) => {

                            acc[cur] = params.getAll(cur).join(',')

                            return acc;

                        }, {}) || null,
                        headers: headers?.keys().reduce((acc, cur) => {

                            acc[cur] = headers.getAll(cur).join(',')

                            return acc;

                        }, {}) || null,
                    };

                    return col.incrementalUpsert(docData);
                }

            }),
        );
    }

    delete(tenant: string, url: string, data?: T, fileFields: FileConfig[] = [], params?: HttpParams, headers?: HttpHeaders): Observable<PwaDocument<T>> {

        return this.get(tenant, url).pipe(

            switchMap(doc => {

                if (doc && doc.method === 'POST') {

                    return from(doc.incrementalRemove());

                } else if (doc && (doc.method === 'PUT' || doc.method === 'DELETE')) {

                    return from(doc.incrementalPatch({method: 'DELETE', error: null}));

                }  else if (doc) {

                    return from(doc.incrementalPatch({method: 'DELETE', error: null, time: new Date().getTime()}));

                } else if (data) {

                    const docData: Partial<PwaDocType<T>> = {
                        tenantUrl: this.makeTenantUrl(tenant, url),
                        matchUrl: this.makeTenantUrl(tenant, url),
                        data,
                        method: 'DELETE',
                        error: null,
                        time: new Date().getTime(),
                        fileFields,
                        params: params?.keys().reduce((acc, cur) => {

                            acc[cur] = params.getAll(cur).join(',')

                            return acc;

                        }, {}) || null,
                        headers: headers?.keys().reduce((acc, cur) => {

                            acc[cur] = headers.getAll(cur).join(',')

                            return acc;

                        }, {}) || null,
                    };

                    return this.collection$.pipe(

                        switchMap(col => col.incrementalUpsert(docData))
                    );

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

                    return from(doc.incrementalPatch({method:'POST'}));
                }

                return throwError(`Cannot duplicate this document. Document: ${JSON.stringify(doc?.toJSON() || {})}`);
            }),

        );
    }

    deleteConflict(tenant: string, url: string): Observable<PwaDocument<any>> {

        return this.get(tenant, url).pipe(

            switchMap(doc => {

                if (!!doc && doc.method !== 'GET') {

                    return from(doc.incrementalRemove());
                }

                return throwError(`Cannot delete this document. Document: ${JSON.stringify(doc?.toJSON() || {})}`);
            }),
        );
    }
}


export class PwaCollectionAPI<T extends Datatype, Database> {

    private config: PwaCollectionAPICreator<Database> = {
        restApiCreator: {
            apiTimeoutInSeconds: 120
        },
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

    listCacheTime: Map<string, number> = new Map();

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

    downloadRetrieve(doc: PwaDocument<T> | null, tenant: string, url: string, params?: HttpParams, headers?: HttpHeaders): Observable<PwaDocument<T> | null> {

        if (!!doc && doc.method !== 'GET') { return of(doc); }

        // check if document is within cacheTime
        const currentTime = new Date().getTime();

        if (!!doc && doc.time >= (currentTime - (this.config.cacheTimeInSeconds * 1000))) { return of(doc); }

        return combineLatest([this.restAPI.get(url, params, headers), this.collectionAPI.collection$]).pipe(

            switchMap(([res, col]) => col.incrementalUpsert({
                tenantUrl: this.collectionAPI.makeTenantUrl(tenant, url),
                matchUrl: this.collectionAPI.makeTenantUrl(tenant, url),
                data: res,
                method: 'GET',
                error: null,
                time: new Date().getTime(),
            })),

            catchError((err) => of(doc)),
        );
    }

    getReactive(tenant: string, url: string, params?: HttpParams, headers?: HttpHeaders, wait = false): Observable<PwaDocument<T> | null> {

        return this.collectionAPI.get(tenant, url).pipe(

            switchMap(doc => wait ?
                this.downloadRetrieve(doc, tenant, url, params, headers) :
                this.downloadRetrieve(doc, tenant, url, params, headers).pipe(startWith(null))
            ),

            switchMap(() => this.collectionAPI.getReactive(tenant, url)),

            auditTime(1000/60),
        );
    }

    get(tenant: string, url: string, params?: HttpParams, headers?: HttpHeaders): Observable<PwaDocument<T> | null> {

        return this.getReactive(tenant, url, params, headers, true).pipe(

            take(1)
        );
    }

    //////////////
    // List
    //////////////

    // tslint:disable-next-line: max-line-length
    downloadList(res: CollectionListResponse<T>, tenant: string, url: string, params?: HttpParams, headers?: HttpHeaders, indexedbUrl = (data: T, tenantUrl: string) => `${tenantUrl}/${data.id}`): Observable<ListResponse<T>> {

        /////////////////////////////////////////
        // check if document is within cacheTime
        /////////////////////////////////////////
        const urlWithParams = url + (params?.toString() || '');

        if (this.listCacheTime.has(urlWithParams)) {

            const cacheTime = this.listCacheTime.get(urlWithParams);

            if (cacheTime >= (new Date().getTime() - (this.config.cacheTimeInSeconds * 1000))) {

                return of(res) as Observable<ListResponse<any>>;
            }
        }

        this.listCacheTime.set(urlWithParams, new Date().getTime());

        ////////////////////////////////////////////////////////////////
        // /*Exclude recents or*/ locally unsynced data in the api results
        ////////////////////////////////////////////////////////////////
        const limit = parseInt(params?.get('limit') || '100');

        const ids = res.results
            .filter(v => v?.method === 'PUT' || v?.method === 'DELETE' /*|| (v?.method === 'GET' && v.time >= (currentTime - (this.config.cacheTimeInSeconds * 1000)))*/)
            .filter(v => !!v?.data)
            .map(v => v?.data?.id);

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

        return this.restAPI.list(url, params, headers).pipe(

            catchError((err) => of({next: null, previous: null, results: []} as ListResponse<T>)),

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

                        return from(col.bulkUpsert(atomicWrites)).pipe(

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
        validQueryKeys: string[] = [],
        headers?: HttpHeaders,
        indexedbUrl = (data: T, tenantUrl: string) => `${tenantUrl}/${data.id}`,
        wait = false,
    ): Observable<PwaListResponse<T>> {

        return this.collectionAPI.list(tenant, url, params, validQueryKeys).pipe(

            switchMap(idbRes => wait ?
                this.downloadList(idbRes, tenant, url, params, headers, indexedbUrl) :
                this.downloadList(idbRes, tenant, url, params, headers, indexedbUrl).pipe(startWith({next: null, previous: null, results: []}))),

            switchMap((networkRes) => this.collectionAPI.listReactive(tenant, url, params, validQueryKeys).pipe(

                auditTime(1000/60),

                map(res => ({
                    next: networkRes?.next || res.next,
                    previous: networkRes?.previous || res.previous,
                    results: res.results
                })),

            )),

        ) as Observable<PwaListResponse<T>>;

    }

    list(
        tenant: string,
        url: string,
        params?: HttpParams,
        validQueryKeys: string[] = [],
        headers?: HttpHeaders,
        indexedbUrl = (data: T, tenantUrl: string) => `${tenantUrl}/${data.id}`
    ): Observable<PwaListResponse<T>> {

        return this.listReactive(tenant, url, params, validQueryKeys, headers, indexedbUrl, true).pipe(

            take(1)
        );

    }
}
