import { Datatype, pwaDocMethods, PwaDocType, PwaDocument } from '../definitions/document';
import { getCollectionCreator, PwaCollection, pwaCollectionMethods, ListResponse, PwaListResponse, CollectionListResponse } from '../definitions/collection';
import { switchMap, map, tap, catchError, startWith, first, debounceTime, shareReplay, distinctUntilChanged} from 'rxjs/operators';
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

    documentsCache: Map<string, Observable<PwaDocument<T>[]>>;
    documentCache: Map<string, Observable<PwaDocument<T>>>;

    collection$: Observable<PwaCollection<T>>;

    constructor(private name: string, private db$: Observable<RxDatabase<Database>>) {

        this.documentsCache = new Map();
        this.documentCache = new Map();

        this.collection$ = this.db$.pipe(

            switchMap(db => name in db ? of([db[name]]) : forkJoin(db.collection(getCollectionCreator(this.name, pwaCollectionMethods, pwaDocMethods)))),

            map(collections => collections[0]),

            first()
        );

    }

    makeTenantUrl(tenant: string, url: string): string {

        return `${tenant}-${url}`;
    }

    getDocumentsFromCache(tenant: string, url: string): Observable<PwaDocument<T>[]> {

        const tenantUrl = this.makeTenantUrl(tenant, url);

        if (!this.documentsCache.has(tenantUrl)) {

            const docs = this.collection$.pipe(

                switchMap(col => col.find({
                    selector: {
                        matchUrl: {$regex: new RegExp(`^${this.makeTenantUrl(tenant, url)}.*`)}   
                    },
                    sort: [{time: 'desc'}] 
                }).$),

                shareReplay(1),

            );

            this.documentsCache.set(tenantUrl, docs);
        }

        return this.documentsCache.get(tenantUrl);
    }

    getDocumentFromCache(tenant: string, url: string): Observable<PwaDocument<T>> {

        const tenantUrl = this.makeTenantUrl(tenant, url);

        if (!this.documentCache.has(tenantUrl)) {

            const doc = this.collection$.pipe(

                switchMap(col => col.findOne({
                    selector: {
                        tenantUrl: {$eq: this.makeTenantUrl(tenant, url)}
                    }
                }).$),

                shareReplay(1),

            );

            this.documentCache.set(tenantUrl, doc);
        }

        return this.documentCache.get(tenantUrl);
    }

    filterList(allDocs: Observable<PwaDocument<T>[]>, params?: HttpParams, validQueryKeys = []): Observable<{
        getCount: number;
        postCount: number;
        putResults: PwaDocument<T>[];
        delResults: PwaDocument<T>[];
        results: PwaDocument<T>[];
    }> {

        const start = parseInt(params?.get('offset') || '0');

        const end = start + parseInt(params?.get('limit') || '100');

        return allDocs.pipe(

            map(allDocs => queryFilter(validQueryKeys, params, allDocs)),

            map(allDocs => ({
                getCount: allDocs.filter(v => v.method === 'GET').length,
                postCount: allDocs.filter(v => v.method === 'POST').length,
                putResults: allDocs.filter(v => v.method === 'PUT'),
                delResults: allDocs.filter(v => v.method === 'DELETE'),
                results: allDocs.slice(start, end)
            })),
        );
    }

    ////////////////
    // CRUD
    ////////////////

    getReactive(tenant: string, url: string): Observable<PwaDocument<T>> {

        return this.getDocumentFromCache(tenant, url);
    }

    get(tenant: string, url: string): Observable<PwaDocument<T>> {

        return this.getReactive(tenant, url).pipe(

            first()
        );
    }

    listReactive(tenant: string, url: string, params?: HttpParams, validQueryKeys = []): Observable<CollectionListResponse<T>> {
   
        return this.filterList(this.getDocumentsFromCache(tenant, url), params, validQueryKeys);
    }

    list(tenant: string, url: string, params?: HttpParams, validQueryKeys = []): Observable<CollectionListResponse<T>> {

        return this.listReactive(tenant, url, params, validQueryKeys).pipe(

            first()
        );
    }

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

        return combineLatest([this.get(tenant, url), this.collection$]).pipe(

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

        const cacheAllowedAge = new Date().getTime() - (this.cacheMaxAge * 1000);

        console.log('Age', idbRes?.time, cacheAllowedAge, (idbRes?.time || 0) > cacheAllowedAge);

        if (idbRes?.method !== 'GET' || (idbRes?.time || 0) > cacheAllowedAge) return of(idbRes);

        return combineLatest([this.restAPI.get(url, params), this.collectionAPI.collection$]).pipe(

            switchMap(([res, col]) => col.atomicUpsert({
                tenantUrl: this.collectionAPI.makeTenantUrl(tenant, url),
                matchUrl: this.collectionAPI.makeTenantUrl(tenant, url),
                data: res,
                method: 'GET',
                error: null,
                time: new Date().getTime(),
            })),

            catchError(() => of(null)),
        );
    }

    getReactive(tenant: string, url: string, params?: HttpParams): Observable<PwaDocument<T>> {

        const apiFetch = this.collectionAPI.get(tenant, url).pipe(

            switchMap(idbRes => this.downloadRetrieve(idbRes, tenant, url, params)),

            startWith(null),
        );

        return apiFetch.pipe(

            switchMap(() => this.collectionAPI.getReactive(tenant, url)),

            distinctUntilChanged((prev, cur) => prev?.method === cur?.method && prev?.time === cur?.time && prev?.error === cur?.error && JSON.stringify(prev) === JSON.stringify(cur)),

        );

    }

    get(tenant: string, url: string, params?: HttpParams): Observable<PwaDocument<T>> {

        return this.collectionAPI.get(tenant, url).pipe(

            switchMap(idbRes => this.downloadRetrieve(idbRes, tenant, url, params)),
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
                const docs: PwaDocType<T>[] = networkRes.results.map(data => ({
                    tenantUrl: `${this.collectionAPI.makeTenantUrl(tenant, url)}/${data.id}`,
                    matchUrl: `${this.collectionAPI.makeTenantUrl(tenant, url)}/${data.id}`,
                    data,
                    method: 'GET',
                    error: null,
                    time: new Date().getTime(),
                }));

                return from(col.bulkInsert(docs)).pipe(

                    map(v => ({apiCount: networkRes.count, success: v.success, error: v.error})),
                );
            }),
        );

    }

    listReactive(tenant: string, url: string, params?: HttpParams, validQueryKeys = []): Observable<PwaListResponse<T>> {

        let apiCount = 0;

        const apiFetch = this.collectionAPI.list(tenant, url, params, validQueryKeys).pipe(

            switchMap(idbRes => this.downloadList(idbRes, tenant, url, params)),

            tap(v => apiCount = v.apiCount),

            startWith(null),
        );

        return apiFetch.pipe(

            switchMap(() => this.collectionAPI.listReactive(tenant, url, params, validQueryKeys)),

            map(res => ({
                count: (apiCount || (res.getCount + res.putResults.length + res.delResults.length)) + res.postCount,
                results: res.results
            }))
        );

    }

    list(tenant: string, url: string, params?: HttpParams, validQueryKeys = []): Observable<PwaListResponse<T>> {

        let apiCount = 0;

        const apiFetch = this.collectionAPI.list(tenant, url, params, validQueryKeys).pipe(

            switchMap(idbRes => this.downloadList(idbRes, tenant, url, params)),

            tap(v => apiCount = v.apiCount),
        );

        return apiFetch.pipe(

            debounceTime(100), // adding delay

            switchMap(() => this.collectionAPI.list(tenant, url, params, validQueryKeys)),

            map(res => ({
                count: (apiCount || (res.getCount + res.putResults.length + res.delResults.length)) + res.postCount,
                results: res.results
            }))
        );
    }

}