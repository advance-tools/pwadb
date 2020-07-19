import { Datatype, pwaDocMethods, PwaDocType, PwaDocument } from '../definitions/document';
import { getCollectionCreator, PwaCollection, pwaCollectionMethods, ListResponse, PwaListResponse, CollectionListResponse } from '../definitions/collection';
import { switchMap, map, catchError, first, shareReplay, distinctUntilChanged } from 'rxjs/operators';
import { Observable, forkJoin, of, from, throwError } from 'rxjs';
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

    collection$: Observable<PwaCollection<T>>;

    constructor(private name: string, private db$: Observable<RxDatabase<Database>>) {

        this.collection$ = this.db$.pipe(

            // tslint:disable-next-line: max-line-length
            switchMap(db => name in db ? of([db[name]]) : forkJoin(db.collection(getCollectionCreator(this.name, pwaCollectionMethods, pwaDocMethods)))),

            map(collections => collections[0]),

            shareReplay(1),

            first()
        );

    }

    makeTenantUrl(tenant: string, url: string): string {

        return `${tenant}____${url}`;
    }

    filterList(docs$: Observable<PwaDocument<T>[]>, params?: HttpParams, validQueryKeys = []): Observable<CollectionListResponse<T>> {

        const start = parseInt(params?.get('offset') || '0');

        const end = start + parseInt(params?.get('limit') || '100');

        return docs$.pipe(

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

        return this.collection$.pipe(

            switchMap(col => col.findOne({selector: { tenantUrl: {$eq: this.makeTenantUrl(tenant, url)}}}).$),

            distinctUntilChanged(),
        );
    }

    get(tenant: string, url: string): Observable<PwaDocument<T>> {

        return this.getReactive(tenant, url).pipe(

            first()
        );
    }

    listReactive(tenant: string, url: string, params?: HttpParams, validQueryKeys = []): Observable<CollectionListResponse<T>> {

        const docs = this.collection$.pipe(

            switchMap(col => col.find({ selector: {matchUrl: {$regex: new RegExp(`^${this.makeTenantUrl(tenant, url)}.*`)}} }).$),

            distinctUntilChanged(),

            map(v => v.sort((a, b) => b.time - a.time)),

        );

        return this.filterList(docs, params, validQueryKeys);
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

        return forkJoin(this.get(tenant, url), this.collection$).pipe(

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

                    return from(doc.remove());

                } else if (doc?.method === 'PUT' || doc?.method === 'DELETE') {

                    return from(doc.atomicUpdate((oldData) => ({...oldData, method: 'DELETE', error: null})));

                }  else {

                    return from(doc.atomicUpdate((oldData) => ({...oldData, method: 'DELETE', error: null, time: new Date().getTime()})));
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

                if (doc?.method !== 'GET' && doc?.method !== 'POST') {

                    return from(doc.atomicSet('method', 'POST'));
                }

                return throwError(`Cannot duplicate this document. Document: ${JSON.stringify(doc?.toJSON())}`);
            })
        );
    }

    deleteConflict(tenant: string, url: string): Observable<boolean> {

        return this.get(tenant, url).pipe(

            switchMap(doc => {

                if (doc?.method !== 'GET') {

                    return from(doc.remove());
                }

                return throwError(`Cannot delete this document. Document: ${JSON.stringify(doc?.toJSON())}`);
            })
        );
    }
}

export class PwaCollectionAPI<T extends Datatype, Database> {

    collectionAPI: CollectionAPI<T, Database>;

    restAPI: RestAPI<T>;

    constructor(private name: string, private db$: Observable<RxDatabase<Database>>, private httpClient: HttpClient) {

        this.collectionAPI = new CollectionAPI<T, Database>(name, db$);

        this.restAPI = new RestAPI<T>(httpClient);
    }

    //////////////
    // Retrieve
    //////////////

    downloadRetrieve(doc: PwaDocument<T> | null, tenant: string, url: string, params?: HttpParams): Observable<PwaDocument<T> | null> {

        if (doc?.method !== 'GET') { return of(doc); }

        return forkJoin(this.restAPI.get(url, params), this.collectionAPI.collection$).pipe(

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

            distinctUntilChanged()

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
    downloadList(res: CollectionListResponse<T>, tenant: string, url: string, params?: HttpParams, collectionSuffixUrl = ''): Observable<number> {

        // Exclude locally unsynced data in the api results
        let httpParams = params || new HttpParams();

        const ids = res.putResults.concat(res.delResults).map(v => v.data.id);

        if (ids.length > 0) { httpParams = httpParams.set('exclude:id', ids.join(',')); }

        return this.restAPI.list(url, httpParams).pipe(

            catchError(() => of({count: 0, results: []} as ListResponse<T>)),

            switchMap(networkRes => this.collectionAPI.collection$.pipe(

                switchMap(col => {

                    // map network data to doctype
                    const atomicWrite = networkRes.results
                        .map(data => ({
                            tenantUrl: `${this.collectionAPI.makeTenantUrl(tenant, url)}${collectionSuffixUrl}/${data.id}`,
                            matchUrl: `${this.collectionAPI.makeTenantUrl(tenant, url)}${collectionSuffixUrl}/${data.id}`,
                            data,
                            method: 'GET',
                            error: null,
                            time: new Date().getTime(),
                        }))
                        .map((d: PwaDocType<T>) => from(col.atomicUpsert(d)));

                    if (atomicWrite.length > 0) {

                        return forkJoin(...atomicWrite).pipe(

                            map(() => networkRes.count)
                        );
                    }

                    return of(networkRes.count);
                })
            )),

        );

    }

    listReactive(tenant: string, url: string, params?: HttpParams, validQueryKeys = [], collectionSuffixUrl = ''): Observable<PwaListResponse<T>> {

        const apiFetch = this.collectionAPI.list(tenant, url, params, validQueryKeys).pipe(

            switchMap(idbRes => this.downloadList(idbRes, tenant, url, params, collectionSuffixUrl)),

        );

        return apiFetch.pipe(

            switchMap(apiCount => this.collectionAPI.listReactive(tenant, url, params, validQueryKeys).pipe(

                map(res => ({
                    count: (apiCount || (res.getCount + res.putResults.length + res.delResults.length)) + res.postCount,
                    results: res.results
                })),

            )),

            distinctUntilChanged()
        );

    }

    list(tenant: string, url: string, params?: HttpParams, validQueryKeys = [], collectionSuffixUrl = ''): Observable<PwaListResponse<T>> {

        return this.listReactive(tenant, url, params, validQueryKeys, collectionSuffixUrl).pipe(

            first(),
        );
    }

}