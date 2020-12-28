import { Datatype, pwaDocMethods, PwaDocType, PwaDocument } from '../definitions/document';
import { getCollectionCreator, PwaCollection, pwaCollectionMethods, ListResponse, PwaListResponse, CollectionListResponse } from '../definitions/collection';
import { switchMap, map, catchError, first, shareReplay, distinctUntilChanged, tap, finalize } from 'rxjs/operators';
import { Observable, forkJoin, of, from, throwError } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { queryFilter } from './filters.resource';
import { RxDatabase } from 'rxdb';
import { NgZone } from '@angular/core';
import { enterZone } from './operators.resource';
import { ApiProgressService } from './apiProgress.resource';


export class RestAPI<T extends Datatype> {

    constructor(private httpClient: HttpClient, private apiProgress?: ApiProgressService) {}

    ////////////////
    // CRUD
    ////////////////

    get(url: string, params?: HttpParams): Observable<T> {

        return of(true).pipe(

            tap(() => { if (!!this.apiProgress) { this.apiProgress.add(); } }),

            switchMap(() => this.httpClient.get(url, {params})),

            finalize(() => {if (!!this.apiProgress) { this.apiProgress.remove(); }}),

        ) as Observable<T>;
    }

    post(url: string, data: Partial<T>): Observable<T> {

        return of(true).pipe(

            tap(() => { if (!!this.apiProgress) { this.apiProgress.add(); } }),

            switchMap(() => this.httpClient.post(url, data)),

            finalize(() => {if (!!this.apiProgress) { this.apiProgress.remove(); }}),

        )  as Observable<T>;
    }

    put(url: string, data: Partial<T>): Observable<T> {

        return of(true).pipe(

            tap(() => { if (!!this.apiProgress) { this.apiProgress.add(); } }),

            switchMap(() => this.httpClient.put(url, data)),

            finalize(() => {if (!!this.apiProgress) { this.apiProgress.remove(); }}),

        ) as Observable<T>;
    }

    list(url: string, params?: HttpParams): Observable<ListResponse<T>> {

        return of(true).pipe(

            tap(() => { if (!!this.apiProgress) { this.apiProgress.add(); } }),

            switchMap(() => this.httpClient.get(url, {params})),

            finalize(() => {if (!!this.apiProgress) { this.apiProgress.remove(); }}),

        ) as Observable<ListResponse<T>>;
    }

    delete(url: string): Observable<any> {

        return of(true).pipe(

            tap(() => { if (!!this.apiProgress) { this.apiProgress.add(); } }),

            switchMap(() => this.httpClient.delete(url)),

            finalize(() => {if (!!this.apiProgress) { this.apiProgress.remove(); }}),

        ) as Observable<any>;
    }
}

export class CollectionAPI<T extends Datatype, Database> {

    collection$: Observable<PwaCollection<T>>;

    private cacheDocument: Map<string, Observable<PwaDocument<T>>>;
    private cacheDocuments: Map<string, Observable<PwaDocument<T>[]>>;

    constructor(private name: string, private db$: Observable<RxDatabase<Database>>, private zone: NgZone) {

        const collectionSchema = {};

        collectionSchema[name] = getCollectionCreator(this.name, pwaCollectionMethods, pwaDocMethods);

        this.collection$ = this.db$.pipe(

            // tslint:disable-next-line: max-line-length
            switchMap(db => {

                if (name in db) {

                    const c = {};

                    c[name] = db[name];

                    return of(c);
                }

                return from(db.addCollections(collectionSchema));
            }),

            map(collections => collections[name]),

            shareReplay(1),

            first()
        );

        this.cacheDocument = new Map();
        this.cacheDocuments = new Map();
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

            map(v => v.sort((a, b) => b.time - a.time)),

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

        const tenantUrl = this.makeTenantUrl(tenant, url);

        if (!this.cacheDocument.has(tenantUrl)) {

            const doc = this.collection$.pipe(

                switchMap(col => col.findOne({selector: { tenantUrl: {$eq: this.makeTenantUrl(tenant, url)}}}).$),

                shareReplay(1),
            );

            this.cacheDocument.set(tenantUrl, doc);
        }

        return this.cacheDocument.get(tenantUrl).pipe(

            enterZone<PwaDocument<T>>(this.zone),
        );
    }

    get(tenant: string, url: string): Observable<PwaDocument<T>> {

        return this.getReactive(tenant, url).pipe(

            first(),
        );
    }

    listReactive(tenant: string, url: string, params?: HttpParams, validQueryKeys = []): Observable<CollectionListResponse<T>> {

        const tenantUrl = this.makeTenantUrl(tenant, url);

        if (!this.cacheDocuments.has(tenantUrl)) {

            const docs = this.collection$.pipe(

                switchMap(col => col.find({ selector: {matchUrl: {$regex: new RegExp(`^${this.makeTenantUrl(tenant, url)}.*`)}} }).$),

                shareReplay(1),
            );

            this.cacheDocuments.set(tenantUrl, docs);

        }

        return this.filterDocs(this.cacheDocuments.get(tenantUrl), url, params, validQueryKeys).pipe(

            enterZone<CollectionListResponse<T>>(this.zone),
        );
    }

    list(tenant: string, url: string, params?: HttpParams, validQueryKeys = []): Observable<CollectionListResponse<T>> {

        return this.listReactive(tenant, url, params, validQueryKeys).pipe(

            first()
        );
    }

    /////////////
    // Actions
    /////////////

    post(tenant: string, url: string, data: T): Observable<PwaDocument<T>> {

        return this.collection$.pipe(

            switchMap(col => col.atomicUpsert({
                tenantUrl: `${this.makeTenantUrl(tenant, url)}/${data.id}`,
                matchUrl: `${this.makeTenantUrl(tenant, url)}/${data.id}`,
                method: 'POST',
                data,
                error: null,
                time: new Date().getTime(),
            })),
        );
    }

    put(tenant: string, url: string, data: T): Observable<PwaDocument<T>> {

        return forkJoin([this.get(tenant, url), this.collection$]).pipe(

            switchMap(([doc, col]) => {

                if (doc) {

                    return doc.atomicUpdate((oldData) => ({
                        ...oldData,
                        method: oldData.method !== 'POST' ? 'PUT' : oldData.method,
                        data,
                        error: null,
                        time: oldData.method === 'GET' ? new Date().getTime() : oldData.time
                    }));

                } else {

                    const docData: PwaDocType<T> = {
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

                    return from(doc.atomicUpdate((oldData) => ({...oldData, method: 'DELETE', error: null})));

                }  else if (!!doc) {

                    return from(doc.atomicUpdate((oldData) => ({...oldData, method: 'DELETE', error: null, time: new Date().getTime()})));

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

    collectionAPI: CollectionAPI<T, Database>;

    restAPI: RestAPI<T>;

    cacheTimeInSeconds = 120;

    constructor(
        private name: string,
        private db$: Observable<RxDatabase<Database>>,
        private httpClient: HttpClient,
        private zone: NgZone,
        private apiProgress?: ApiProgressService
    ) {

        this.collectionAPI = new CollectionAPI<T, Database>(this.name, this.db$, this.zone);

        this.restAPI = new RestAPI<T>(this.httpClient, this.apiProgress);
    }

    //////////////
    // Retrieve
    //////////////

    downloadRetrieve(doc: PwaDocument<T> | null, tenant: string, url: string, params?: HttpParams): Observable<PwaDocument<T> | null> {

        if (!!doc && doc.method !== 'GET') { return of(doc); }

        // check if document is within cacheTime
        const currentTime = new Date().getTime();

        if (!!doc && doc.time >= (currentTime - (this.cacheTimeInSeconds * 1000))) { return of(doc); }

        return forkJoin([this.restAPI.get(url, params), this.collectionAPI.collection$]).pipe(

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

    getReactive(tenant: string, url: string, params?: HttpParams): Observable<PwaDocument<T>> {

        return this.collectionAPI.get(tenant, url).pipe(

            switchMap(doc => this.downloadRetrieve(doc, tenant, url, params)),

            switchMap(() =>  this.collectionAPI.getReactive(tenant, url)),

        );
    }

    get(tenant: string, url: string, params?: HttpParams): Observable<PwaDocument<T>> {

        return this.getReactive(tenant, url, params).pipe(

            first()
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
        let httpParams = params || new HttpParams();

        const ids = res.results
            // tslint:disable-next-line: max-line-length
            .filter(v => v.method === 'PUT' || v.method === 'DELETE' || (v.method === 'GET' && v.time >= (currentTime - (this.cacheTimeInSeconds * 1000))))
            .map(v => v.data.id);

        if (ids.length === limit) {

            // pass if all results are excluded
            return of({next: res.next, previous: res.previous, results: /*res.results.map(r => r.toJSON().data)*/ []});
        }

        if (ids.length > 0) { httpParams = httpParams.set('exclude:id', ids.join(',')).set('limit', (limit - ids.length).toString()); }

        return this.restAPI.list(url, httpParams).pipe(

            catchError(() => of({next: null, previous: null, results: []} as ListResponse<T>)),

            switchMap(networkRes => this.collectionAPI.collection$.pipe(

                switchMap(col => {

                    // map network data to doctype
                    const atomicWrite = networkRes.results
                        .map(data => ({
                            tenantUrl: indexedbUrl(data, this.collectionAPI.makeTenantUrl(tenant, url)),
                            matchUrl: indexedbUrl(data, this.collectionAPI.makeTenantUrl(tenant, url)),
                            data,
                            method: 'GET',
                            error: null,
                            time: new Date().getTime(),
                        }))
                        .map((d: PwaDocType<T>) => from(col.atomicUpsert(d)));

                    if (atomicWrite.length > 0) {

                        return forkJoin(...atomicWrite).pipe(

                            map(() => networkRes)
                        );
                    }

                    return of(networkRes);
                })
            )),

        );

    }

    listReactive(tenant: string, url: string, params?: HttpParams, validQueryKeys = [], indexedbUrl = (data: T, tenantUrl: string) => `${tenantUrl}/${data.id}`): Observable<PwaListResponse<T>> {

        const apiFetch = this.collectionAPI.list(tenant, url, params, validQueryKeys).pipe(

            switchMap(idbRes => this.downloadList(idbRes, tenant, url, params, indexedbUrl)),

        );

        return apiFetch.pipe(

            switchMap(networkRes => this.collectionAPI.listReactive(tenant, url, params, validQueryKeys).pipe(

                map(res => ({
                    next: networkRes?.next || res.next,
                    previous: networkRes?.previous || res.previous,
                    results: res.results
                })),

            )),

        ) as Observable<PwaListResponse<T>>;

    }

    list(tenant: string, url: string, params?: HttpParams, validQueryKeys = [], indexedbUrl = (data: T, tenantUrl: string) => `${tenantUrl}/${data.id}`): Observable<PwaListResponse<T>> {

        return this.listReactive(tenant, url, params, validQueryKeys, indexedbUrl).pipe(

            first()
        );

    }
}
