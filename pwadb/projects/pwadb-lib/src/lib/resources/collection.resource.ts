import { Datatype, pwaDocMethods, PwaDocType, PwaDocument } from '../definitions/document';
import { getCollectionCreator, PwaCollection, pwaCollectionMethods, ListResponse, PwaListResponse, CollectionListResponse } from '../definitions/collection';
import { switchMap, map, take, tap, share, catchError, startWith, shareReplay } from 'rxjs/operators';
import { Observable, forkJoin, of, combineLatest, from } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { queryFilter } from './filters.resource';
import { RxDatabase } from 'rxdb';

export class RestAPI<T extends Datatype> {

    constructor(private httpClient: HttpClient) {}

    ////////////////
    // CRUD
    ////////////////

    get(url: string, params?: HttpParams): Observable<T> {

        return this.httpClient.get(url, {params}) as Observable<T>;
    }

    post(url: string, data: Partial<T>): Observable<T> {

        return this.httpClient.post(url, data) as Observable<T>;
    }

    put(url: string, data: Partial<T>): Observable<T> {

        return this.httpClient.put(url, data) as Observable<T>;
    }

    list(url: string, params?: HttpParams): Observable<ListResponse<T>> {

        return this.httpClient.get(url, {params}) as Observable<ListResponse<T>>;
    }

    delete(url: string): Observable<any> {

        return this.httpClient.delete(url) as Observable<any>;
    }
}

export class CollectionAPI<T extends Datatype, Database> {

    cache: Map<string, Observable<PwaDocument<T>[]>>;

    collection$: Observable<PwaCollection<T>>;

    constructor(private name: string, private db$: Observable<RxDatabase<Database>>) {

        this.cache = new Map();

        this.collection$ = this.db$.pipe(

            switchMap(db => name in db ? of([db[name]]) : forkJoin(db.collection(getCollectionCreator(this.name, pwaCollectionMethods, pwaDocMethods)))),

            map(collections => collections[0]),

            take(1),

        );

    }

    makeTenantUrl(tenant: string, url: string) {

        return `${tenant}-${url}`;
    }

    getDocuments(tenant: string, url: string) {

        const tenantUrl = this.makeTenantUrl(tenant, url);

        if (!this.cache.has(tenantUrl)) {

            const docs = this.collection$.pipe(

                switchMap(col => col.find({tenantUrl: {$regex: new RegExp(`^${this.makeTenantUrl(tenant, url)}.*`)}}).sort({time: 'desc'}).$),

                shareReplay(1),
            );

            this.cache.set(tenantUrl, docs);
        }

        return this.cache.get(tenantUrl);
    }

    ////////////////
    // CRUD
    ////////////////

    getReactive(tenant: string, url: string): Observable<PwaDocument<T>> {

        return this.collection$.pipe(

            switchMap(col => col.findOne({tenantUrl: {$eq: this.makeTenantUrl(tenant, url)}}).$),
        );
    }

    get(tenant: string, url: string): Observable<PwaDocument<T>> {

        return this.getReactive(tenant, url).pipe(

            take(1),

        );
    }

    listReactive(tenant: string, url: string, params?: HttpParams, validQueryKeys = []): Observable<CollectionListResponse<T>> {

        const start = parseInt(params?.get('offset') || '0');

        const end = start + parseInt(params?.get('limit') || '100');

        return this.getDocuments(tenant, url).pipe(

            map(docs => queryFilter(validQueryKeys, params, docs)),

            map(docs => ({
                getCount: docs.filter(v => v.method === 'GET').length,
                postCount: docs.filter(v => v.method === 'POST').length,
                putResults: docs.filter(v => v.method === 'PUT'),
                delResults: docs.filter(v => v.method === 'DELETE'),
                results: docs.slice(start, end)
            })),

        );
    }

    list(tenant: string, url: string, params?: HttpParams, validQueryKeys = []): Observable<CollectionListResponse<T>> {

        return this.listReactive(tenant, url, params, validQueryKeys).pipe(

            take(1),

        );
    }

    post(tenant: string, url: string, data: T): Observable<PwaDocument<T>> {

        return this.collection$.pipe(

            switchMap(col => col.atomicUpsert({
                tenantUrl: this.makeTenantUrl(tenant, `${url}/${data.id}`),
                data,
                method: 'POST',
                error: null,
                time: new Date().getTime(),
                tenant
            })),
        );
    }

    put(tenant: string, url: string, data: T): Observable<PwaDocument<T>> {

        return combineLatest([this.get(tenant, url), this.collection$]).pipe(

            switchMap(([doc, col]) => {

                if (doc) {

                    return doc.atomicUpdate((oldData) => ({
                        ...oldData,
                        method: oldData.method !== 'POST' ? 'PUT' : oldData.method,
                        data,
                        error: null
                    }));

                } else {

                    const docData: PwaDocType<T> = {
                        tenantUrl: this.makeTenantUrl(tenant, url),
                        data,
                        method: 'PUT',
                        error: null,
                        time: new Date().getTime(),
                        tenant
                    };
    
                    return col.atomicUpsert(docData);
                }

            }),
        );
    }

    delete(tenant: string, url: string): Observable<boolean | PwaDocument<T>> {

        return this.get(tenant, url).pipe(

            switchMap(doc => {

                if (doc?.method === 'POST') {

                    return doc.remove();

                } else if (doc?.method === 'PUT' || doc?.method === 'DELETE') {

                    return doc.atomicUpdate((oldData) => ({...oldData, method: 'DELETE', error: null}));

                }  else {

                    return doc.atomicUpdate((oldData) => ({...oldData, method: 'DELETE', error: null, time: new Date().getTime()}));
                }

            })
        );
    }

}

export class PwaCollectionAPI<T extends Datatype, Database> {

    collectionAPI: CollectionAPI<T, Database>;

    restAPI: RestAPI<T>;

    cacheMaxAge = 10 // in seconds

    constructor(private name: string, private db$: Observable<RxDatabase<Database>>, private httpClient: HttpClient) {

        this.collectionAPI = new CollectionAPI<T, Database>(name, db$);

        this.restAPI = new RestAPI<T>(httpClient);
    }

    //////////////
    // Retrieve
    //////////////

    downloadRetrieve(idbRes: PwaDocument<T>, tenant: string, url: string, params?: HttpParams): Observable<PwaDocument<T> | null> {

        const cacheAllowedAge = new Date().getMilliseconds() - (this.cacheMaxAge * 1000);

        if (idbRes?.method !== 'GET' || (idbRes?.time || 0) > cacheAllowedAge) return of(idbRes);

        return combineLatest([this.restAPI.get(url, params), this.collectionAPI.collection$]).pipe(

            switchMap(([res, col]) => col.atomicUpsert({
                tenantUrl: this.collectionAPI.makeTenantUrl(tenant, url),
                data: res,
                method: 'GET',
                error: null,
                time: new Date().getTime(),
                tenant
            })),

            catchError(() => of(null)),
        );
    }

    getReactive(tenant: string, url: string, params?: HttpParams): Observable<PwaDocument<T>> {

        const idbGet = this.collectionAPI.get(tenant, url);

        const idbGetReactive = this.collectionAPI.getReactive(tenant, url);

        const apiFetch = idbGet.pipe(

            switchMap(idbRes => this.downloadRetrieve(idbRes, tenant, url, params)),

            startWith(null),
        );

        return apiFetch.pipe(

            switchMap(() => idbGetReactive)
        );

    }

    get(tenant: string, url: string, params?: HttpParams): Observable<PwaDocument<T>> {

        const idbGet = this.collectionAPI.get(tenant, url);

        const apiFetch = idbGet.pipe(

            switchMap(idbRes => this.downloadRetrieve(idbRes, tenant, url, params)),
        );

        return apiFetch.pipe(

            switchMap(() => idbGet)
        );
    }

    //////////////
    // List
    //////////////

    downloadList(idbRes: CollectionListResponse<T>, tenant: string, url: string, params?: HttpParams): Observable<{apiCount: number, success: PwaDocument<T>[], error: any[]}> {

        // Exclude locally unsynced data in the api results
        let httpParams = params || new HttpParams();

        const ids = idbRes.putResults.concat(idbRes.delResults).map(v => v.data.id);

        if (ids.length > 0) httpParams = httpParams.set('exclude:id', ids.join(','));

        return this.restAPI.list(url, httpParams).pipe(

            catchError(() => of({count: 0, results: []} as ListResponse<T>)),

            switchMap(networkRes => combineLatest([of(networkRes), this.collectionAPI.collection$])),

            switchMap(([networkRes, col]) => {

                // map network data to doctype
                const docs: PwaDocType<T>[] = networkRes.results.map(d => ({
                    tenantUrl: `${this.collectionAPI.makeTenantUrl(tenant, url)}/${d.id}`,
                    data: d,
                    method: 'GET',
                    error: null,
                    time: new Date().getTime(),
                    tenant
                }));

                return from(col.bulkInsert(docs)).pipe(

                    map(v => ({apiCount: networkRes.count, success: v.success, error: v.error})),
                );
            }),
        );

    }

    listReactive(tenant: string, url: string, params?: HttpParams, validQueryKeys = []): Observable<PwaListResponse<T>> {

        let apiCount = 0;

        const idbFetchOne = this.collectionAPI.list(tenant, url, params, validQueryKeys);

        const idbFetchReactive = this.collectionAPI.listReactive(tenant, url, params, validQueryKeys).pipe(

            map(res => ({
                count: (apiCount || (res.getCount + res.putResults.length + res.delResults.length)) + res.postCount,
                results: res.results
            }))
        );

        const apiFetch = idbFetchOne.pipe(

            switchMap(idbRes => this.downloadList(idbRes, tenant, url, params)),

            tap(v => apiCount = v.apiCount),

            startWith(null),
        );

        return apiFetch.pipe(

            switchMap(() => idbFetchReactive)
        );

    }

    list(tenant: string, url: string, params?: HttpParams, validQueryKeys = []): Observable<PwaListResponse<T>> {

        let apiCount = 0;

        const idbFetchOne = this.collectionAPI.list(tenant, url, params, validQueryKeys);

        const apiFetch = idbFetchOne.pipe(

            switchMap(idbRes => this.downloadList(idbRes, tenant, url, params)),

            tap(v => apiCount = v.apiCount),
        );

        return apiFetch.pipe(

            switchMap(() => idbFetchOne),

            map(res => ({
                count: (apiCount || (res.getCount + res.putResults.length + res.delResults.length)) + res.postCount,
                results: res.results
            }))
        );
    }

}