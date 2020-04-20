import { Datatype, pwaDocMethods, PwaDocType, PwaDocument } from '../definitions/document';
import { getCollectionCreator, PwaCollection, pwaCollectionMethods, ListResponse, PwaListResponse, CollectionListResponse } from '../definitions/collection';
import { switchMap, map, filter, take, tap, share} from 'rxjs/operators';
import { Observable, Subscription, combineLatest, forkJoin, of, concat } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { queryFilter } from './filters.resource';
import { RxDatabase } from 'rxdb';

export class RestAPI<T extends Datatype> {

    constructor(private httpClient: HttpClient) {}

    ////////////////
    // CRUD
    ////////////////

    get(url: string, params?: HttpParams) {

        return this.httpClient.get(url, {params}) as Observable<T>;
    }

    post(url: string, data: Partial<T>) {

        return this.httpClient.post(url, data) as Observable<T>;
    }

    put(url: string, data: Partial<T>) {

        return this.httpClient.put(url, data) as Observable<T>;
    }

    list(url: string, params?: HttpParams) {

        return this.httpClient.get(url, {params}) as Observable<ListResponse<T>>;
    }

    delete(url: string) {

        return this.httpClient.delete(url) as Observable<any>;
    }
}

export class CollectionAPI<T extends Datatype, Database> {

    collection$: Observable<PwaCollection<T>>;

    constructor(private name: string, private db$: Observable<RxDatabase<Database>>) {

        this.collection$ = this.db$.pipe(

            switchMap(db => name in db ? of([db[name]]) : forkJoin(db.collection(getCollectionCreator(this.name, pwaCollectionMethods, pwaDocMethods)))),

            map(collections => collections[0]),

            share(),
        );

    }

    makeTenantUrl(tenant: string, url: string) {

        return `${tenant}-${url}`;
    }

    dataToDoc(d: T, tenant: string, url: string):PwaDocType<T> {

        return {tenantUrl: `${this.makeTenantUrl(tenant, url)}/${d.id}`, data: d, time: new Date().getTime(), method: 'GET', error: null, tenant};
    }

    ////////////////
    // CRUD
    ////////////////

    get$(tenant: string, url: string) {

        return this.collection$.pipe(

            switchMap(col => col.findOne({tenantUrl: {$eq: this.makeTenantUrl(tenant, url)}}).$)

        ) as Observable<PwaDocument<T>>;
    }

    getExec(tenant: string, url: string) {

        return this.get$(tenant, url).pipe(

            take(1),

        ) as Observable<PwaDocument<T>>;
    }

    list$(tenant: string, url: string, params?: HttpParams, validQueryKeys = []) {

        const start = parseInt(params?.get('offset') || '0');

        const end = start + parseInt(params?.get('limit') || '100');

        return this.data$(tenant, url).pipe(

            map(docs => queryFilter(validQueryKeys, params, docs)),

            map(docs => ({
                getCount: docs.filter(v => v.method === 'GET').length,
                postCount: docs.filter(v => v.method === 'POST').length,
                putResults: docs.filter(v => v.method === 'PUT'),
                delResults: docs.filter(v => v.method === 'DELETE'),
                results: docs.slice(start, end)
            })),

        ) as Observable<CollectionListResponse<T>>;
    }

    listExec(tenant: string, url: string, params?: HttpParams, validQueryKeys = []) {

        return this.list$(tenant, url, params, validQueryKeys).pipe(

            take(1),

        ) as Observable<CollectionListResponse<T>>;
    }

    post(tenant: string, url: string, data: T) {

        return this.collection$.pipe(

            switchMap(col => col.atomicUpsert({tenantUrl: this.makeTenantUrl(tenant, `${url}/${data.id}`), data, time: new Date().getTime(), method: 'POST', error: null, tenant}))
        );
    }

    put(tenant: string, url: string, data: T) {

        return this.getExec(tenant, url).pipe(

            switchMap(doc => {

                const docData: PwaDocType<T> = {
                    tenantUrl: this.makeTenantUrl(tenant, url),
                    data,
                    method: doc?.method || 'PUT',
                    error: null,
                    time: doc?.time || new Date().getTime(),
                    tenant
                };

                return doc.collection.atomicUpsert(docData);
            }),
        );
    }

    delete(tenant: string, url: string) {

        return this.getExec(tenant, url).pipe(

            switchMap(doc => {

                if (doc?.method === 'POST') {

                    return doc.remove();

                } else if (doc?.method === 'PUT' || doc?.method === 'DELETE') {

                    return doc.collection.atomicUpsert({tenantUrl: this.makeTenantUrl(tenant, url), method: 'DELETE', error: null});

                }  else {

                    return doc.collection.atomicUpsert({tenantUrl: this.makeTenantUrl(tenant, url), method: 'DELETE', error: null, time: new Date().getTime()});
                }

            })
        );
    }

    /////////////////
    // Miscellaneous
    /////////////////

    data$(tenant: string, url: string) {

        return this.collection$.pipe(

            switchMap(col => col.find({tenantUrl: {$regex: new RegExp(`^${this.makeTenantUrl(tenant, url)}.*`)}}).$),

        );
    }

    trim(skip = 1000, order: 'desc' | 'asc' = 'desc') {

        return this.collection$.pipe(

            switchMap(col => col.find({$and: [{method: {$eq: 'GET'}}, {time: {$gte: 0}}]}).sort({time: order}).skip(skip).remove()),
        );
    }

}

export class PwaCollectionAPI<T extends Datatype, Database> {

    collectionAPI: CollectionAPI<T, Database>;

    restAPI: RestAPI<T>;

    // unsubscrive OnDestroy in service
    subs: Subscription;

    constructor(private name: string, private db$: Observable<RxDatabase<Database>>, private httpClient: HttpClient) {

        this.collectionAPI = new CollectionAPI<T, Database>(name, db$);

        this.restAPI = new RestAPI<T>(httpClient);

        this.subs = new Subscription();
    }

    //////////////
    // CRUDS
    ///////////////

    preload(tenant: string, url: string, params?: HttpParams): Observable<PwaDocument<T>[]> {

        const preloadData$ = this.restAPI.list(url, params).pipe(

            map(res => res.results),

            map(v => v.map(d => this.collectionAPI.dataToDoc(d, tenant, url)))

        ) as Observable<PwaDocType<T>[]>;

        const bulkInsert$ = combineLatest([this.collectionAPI.collection$, preloadData$]).pipe(

            take(1),

            switchMap(([col, preloadData]) => forkJoin(concat(...preloadData.map(v => col.atomicUpsert(v))))),
        );

        return this.collectionAPI.collection$.pipe(

            switchMap(col => col.findOne({tenant: {$eq: tenant}}).exec()),

            filter(doc => !!doc),

            switchMap(() => bulkInsert$),

        );
    }

    get$(tenant: string, url: string, params?: HttpParams): Observable<PwaDocument<T>> {

        let count = 0;

        return this.collectionAPI.get$(tenant, url).pipe(

            tap(doc => {
                
                if (count === 0 && doc?.method === 'GET') {
                    
                    count = 1;

                    const subs = this.restAPI.get(url, params).pipe(

                        switchMap(res => doc.collection.atomicUpsert({tenantUrl: this.collectionAPI.makeTenantUrl(tenant, url), data: res, time: new Date().getTime(), error: null, tenant})),

                    ).subscribe();
                    
                    this.subs.add(subs);
                }
            })

        );

    }

    getExec(tenant: string, url: string, params?: HttpParams): Observable<PwaDocument<T>> {

        return this.get$(tenant, url, params).pipe(

            take(2),

        );
    }

    list$(tenant: string, url: string, params?: HttpParams, validQueryKeys = []): Observable<PwaListResponse<T>> {

        let count = 0;
        let apiCount = 0;

        return this.collectionAPI.list$(tenant, url, params, validQueryKeys).pipe(

            tap(res => {

                if (count === 0) {

                    count = 1;

                    const subs = this.collectionAPI.collection$.pipe(

                        switchMap(col => {

                            let httpParams = params || new HttpParams();

                            res.putResults.concat(res.delResults).forEach(v => httpParams = httpParams.append('exclude:id', v.data.id));

                            return this.restAPI.list(url, httpParams).pipe(

                                tap(apiRes => apiCount = apiRes.count),

                                switchMap(apiRes => forkJoin(concat(...apiRes.results.map(d => col.atomicUpsert(this.collectionAPI.dataToDoc(d, tenant, url))))))
                            );
                        }),

                    ).subscribe();

                    this.subs.add(subs);
                }

            }),

            map(res => ({
                count: (apiCount || (res.getCount + res.putResults.length + res.delResults.length)) + res.postCount,
                results: res.results
            })),

        );

    }

    listExec(tenant: string, url: string, params?: HttpParams, validQueryKeys = []): Observable<PwaListResponse<T>> {

        return this.list$(tenant, url, params, validQueryKeys).pipe(

            take(2),

        );
    }

}