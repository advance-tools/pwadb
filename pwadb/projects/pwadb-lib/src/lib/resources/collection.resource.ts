import { Datatype, pwaDocMethods, PwaDocType, PwaDocument } from '../definitions/document';
import { getCollectionCreator, PwaCollection, pwaCollectionMethods } from '../definitions/collection';
import { PwaDatabaseService } from './database.resource';
import { switchMap, map, filter, take, tap, share } from 'rxjs/operators';
import { Observable, from, Subscription, combineLatest } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { queryFilter } from './filters.resource';

export interface ListResponse<T extends Datatype> {
    count: number;
    next: string;
    previous: string;
    results: T[];
}

export interface PwaListResponse<T extends Datatype> {
    count: number;
    results: PwaDocument<T>[];
}

export class RestAPI<T extends Datatype> {

    apiCount = 0;

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

        return this.httpClient.get(url, {params}).pipe(

            tap((res: ListResponse<T>) => this.apiCount = res.count),

        ) as Observable<ListResponse<T>>;
    }

    delete(url: string) {

        return this.httpClient.delete(url) as Observable<any>;
    }
}

export class CollectionAPI<T extends Datatype, Database> {

    collection$: Observable<PwaCollection<T>>;

    postIds = [];
    putIds = [];
    delIds = [];
    getIds = [];

    constructor(private name: string, private dbService: PwaDatabaseService<Database>) {

        this.collection$ = this.dbService.db$.pipe(

            switchMap(db => from(db.collection(getCollectionCreator(this.name, pwaCollectionMethods, pwaDocMethods)))),

            share(),
        );

    }

    makeTenantUrl(tenant: string, url: string) {

        return `${tenant}-${url}`;
    }

    dataToDoc(d: T, tenant: string, url: string) {

        return {tenantUrl: `${this.makeTenantUrl(tenant, url)}/${d.id}`, data: d, time: new Date().getTime(), method: 'GET', error: null, tenant} as PwaDocType<T>;
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

        return this.data$(tenant, url).pipe(

            map(docs => queryFilter(validQueryKeys, params, docs)),

            map(docs => ({count: docs.length, results: docs.slice(parseFloat(params.get('offset')) || 0, parseFloat(params.get('limit')) || 100)}))

        ) as Observable<PwaListResponse<T>>;
    }

    listExec(tenant: string, url: string, params?: HttpParams, validQueryKeys = []) {

        return this.list$(tenant, url, params, validQueryKeys).pipe(

            take(1),

        ) as Observable<PwaListResponse<T>>;
    }

    post(tenant: string, url: string, data: T) {

        return this.collection$.pipe(

            switchMap(col => col.atomicUpsert({tenantUrl: this.makeTenantUrl(tenant, url), data, time: new Date().getTime(), method: 'POST', error: null, tenant}))
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

            switchMap(col => col.find({$and: [{tenant: {$eq: tenant}}, {tenantUrl: {$regex: new RegExp(`^${this.makeTenantUrl(tenant, url)}.*`)}}]}).$),

            tap(docs => {

                this.getIds = [];
                this.postIds = [];
                this.putIds = [];
                this.delIds = [];

                docs.forEach(v => {

                    if (v.method === 'GET') this.getIds.push(v.data.id);

                    if (v.method === 'POST') this.postIds.push(v.data.id);

                    if (v.method === 'PUT') this.putIds.push(v.data.id);

                    if (v.method === 'DELETE') this.delIds.push(v.data.id);
                });
            })
        );
    }

    trim(skip = 1000, order: 'desc' | 'asc' = 'desc') {

        return this.collection$.pipe(

            take(1),

            switchMap(col => col.find({$and: [{method: {$eq: 'GET'}}, {time: {$gte: 0}}]}).sort({time: order}).skip(skip).remove()),
        );
    }

}

export class PwaCollectionAPI<T extends Datatype, Database> {

    collectionAPI: CollectionAPI<T, Database>;

    restAPI: RestAPI<T>;

    // unsubscrive OnDestroy in service
    subs: Subscription;

    constructor(private name: string, private dbService: PwaDatabaseService<Database>, private httpClient: HttpClient) {

        this.collectionAPI = new CollectionAPI<T, Database>(name, dbService);

        this.restAPI = new RestAPI<T>(httpClient);

        this.subs = new Subscription();
    }

    //////////////
    // CRUDS
    ///////////////

    preload(tenant: string, url: string, params?: HttpParams) {

        const preloadData$ = this.restAPI.list(url, params).pipe(

            map(res => res.results),

            map(v => v.map(d => this.collectionAPI.dataToDoc(d, tenant, url)))

        ) as Observable<PwaDocType<T>[]>;

        const bulkInsert$ = combineLatest([this.collectionAPI.collection$, preloadData$]).pipe(

            switchMap(([col, preloadData]) => col.bulkInsert(preloadData)),
        );

        return this.collectionAPI.collection$.pipe(

            switchMap(col => col.findOne().exec()),

            filter(doc => !!doc),

            switchMap(() => bulkInsert$),

        ) as Observable<{success: PwaDocument<T>[], error: any[]}>;
    }

    get$(tenant: string, url: string, params?: HttpParams) {

        let count = 0;

        return this.collectionAPI.get$(tenant, url).pipe(

            tap(doc => {

                if (count === 0 && doc?.method === 'GET') {

                    const subs = this.restAPI.get(url, params).pipe(

                        switchMap(res => doc.collection.atomicUpsert({tenantUrl: this.collectionAPI.makeTenantUrl(tenant, url), data: res, time: new Date().getTime(), error: null, tenant})),

                    ).subscribe();

                    this.subs.add(subs);

                    count = 1;
                }
            })

        ) as Observable<PwaDocument<T>>;

    }

    getExec(tenant: string, url: string, params?: HttpParams) {

        return this.get$(tenant, url, params).pipe(

            take(1)

        ) as Observable<PwaDocument<T>>;
    }

    list$(tenant: string, url: string, params?: HttpParams, validQueryKeys = []) {

        let count = 0;

        return this.collectionAPI.list$(tenant, url, params, validQueryKeys).pipe(

            tap(() => {

                if (count === 0) {

                    const subs = this.collectionAPI.collection$.pipe(

                        switchMap(col => this.restAPI.list(url, params.append('exclude:id', this.excludeIds)).pipe(

                            switchMap(res => col.bulkInsert(res.results.map(d => this.collectionAPI.dataToDoc(d, tenant, url))))
                        )),

                    ).subscribe()

                    this.subs.add(subs);

                    count = 1;
                }

            }),

            map(res => ({
                count: (this.restAPI.apiCount || this.fallBackCount) + this.collectionAPI.postIds.length,
                results: res.results
            })),

        ) as Observable<PwaListResponse<T>>;

    }

    listExec(tenant: string, url: string, params?: HttpParams, validQueryKeys = []) {

        return this.list$(tenant, url, params, validQueryKeys).pipe(

            take(1),

        ) as Observable<PwaListResponse<T>>;
    }

    ////////////////
    // Miscellaneous
    /////////////////

    get excludeIds() {

        return this.collectionAPI.putIds.concat(this.collectionAPI.delIds).reduce((acc, cur, i, arr) => acc += cur + (i === arr.length - 1 ? '' : ',') , '') as string;
    }

    get fallBackCount() {

        return this.collectionAPI.putIds.concat(this.collectionAPI.delIds).concat(this.collectionAPI.getIds).length;
    }


}