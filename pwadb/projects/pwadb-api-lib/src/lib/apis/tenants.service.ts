import { PwaCollectionAPI, PwaDocument, CollectionListResponse } from 'pwadb-lib';
import { Tenant, MyDatabase, Collections, hostURL } from '../resources/schema.resource';
import { DatabaseService } from './database.service';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subscription } from 'rxjs';
import { OnDestroy, Injectable } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { map, filter, switchMap } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class TenantApiService extends PwaCollectionAPI<Tenant, MyDatabase> implements OnDestroy {

    tenant = 'root'
    validQueryKeys = []

    id$: Observable<string>;

    subs: Subscription;

    constructor(private dbService: DatabaseService, private httpService: HttpClient, private route: ActivatedRoute) {

        super(Collections.tenant, dbService.db$, httpService);

        this.subs = new Subscription();

        this.id$ = this.route.queryParamMap.pipe(

            map(queryParams => queryParams.get('tenantId')),

            filter(t => !!t),
        );

    }

    ngOnDestroy() {
        
        this.subs.unsubscribe();
    }

    retrieveReactive(params?: HttpParams): Observable<PwaDocument<Tenant>> {

        return this.id$.pipe(
            
            switchMap(id => this.get$(this.tenant, `${hostURL}/profile/${id}`, params))
        );
    }

    retrieve(params?: HttpParams): Observable<PwaDocument<Tenant>> {

        return this.id$.pipe(

            switchMap(id => this.getExec(this.tenant, `${hostURL}/profile/${id}`, params))
        );
    }

    fetchReactive(params?: HttpParams): Observable<CollectionListResponse<Tenant>> {

        return this.collectionAPI.list$(this.tenant, `${hostURL}/profile`, params, this.validQueryKeys);
    }

    fetch(params?: HttpParams): Observable<CollectionListResponse<Tenant>> {

        return this.collectionAPI.listExec(this.tenant, `${hostURL}/profile`, params, this.validQueryKeys);
    }

    create(data: Tenant): Observable<PwaDocument<Tenant>> {

        return this.collectionAPI.post(this.tenant, `${hostURL}/profile`, data);
    }

    update(data: Tenant): Observable<PwaDocument<Tenant>> {

        return this.collectionAPI.put(this.tenant, `${hostURL}/profile/${data.id}`, data);
    }

    delete(): Observable<boolean | PwaDocument<Tenant>> {

        return this.id$.pipe(

            switchMap(id => this.collectionAPI.delete(this.tenant, `${hostURL}/profile/${id}`))
        );
    }
}