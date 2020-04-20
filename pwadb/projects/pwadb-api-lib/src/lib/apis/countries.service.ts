import { PwaCollectionAPI, PwaDocument, PwaListResponse, TableLoadMoreDatabase, DatasourceService, TreeLoadMoreDatabase } from 'pwadb-lib';
import { Country, MyDatabase, Collections, hostURL } from '../resources/schema.resource';
import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { DatabaseService } from './database.service';
import { Observable, Subscription } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { map, switchMap, filter } from 'rxjs/operators';

@Injectable({
    providedIn: 'root',
})
export class CountriesApiService extends PwaCollectionAPI<Country, MyDatabase> implements OnDestroy, DatasourceService<Country> {

    validQueryKeys = [];
    tenant$: Observable<string>;

    subs: Subscription;

    constructor(private dbService: DatabaseService, private httpService: HttpClient, private route: ActivatedRoute) {

        super(Collections.country, dbService.db$, httpService);

        this.subs = new Subscription();

        this.tenant$ = this.route.queryParamMap.pipe(

            map(queryParams => queryParams.get('tenantId')),

            filter(tenantId => !!tenantId),
        )

        // const subs = concat(this.collectionAPI.trim(), this.download()).subscribe();

        // this.subs.add(subs);
    }

    ngOnDestroy() {
        
        this.subs.unsubscribe();
    }
    
    download(): Observable<PwaDocument<Country>[]> {

        const params = new HttpParams();

        params.append('offset', '0');

        params.append('limit', '1000');

        return this.tenant$.pipe(

            switchMap(tenant => this.preload(tenant, `${hostURL}/countries-base`, params))
        );
    }

    retrieveReactive(id: string, params?: HttpParams): Observable<PwaDocument<Country>> {

        return this.tenant$.pipe(

            switchMap(tenant => this.get$(tenant, `${hostURL}/countries-base/${id}`, params))
        );
    }

    retrieve(id: string, params?: HttpParams): Observable<PwaDocument<Country>> {

        return this.tenant$.pipe(

            switchMap(tenant => this.getExec(tenant, `${hostURL}/countries-base/${id}`, params))
        );
    }

    fetchReactive(params?: HttpParams): Observable<PwaListResponse<Country>> {

        return this.tenant$.pipe(

            switchMap(tenant => this.list$(tenant, `${hostURL}/countries-base`, params, this.validQueryKeys))
        );
    }

    fetch(params?: HttpParams): Observable<PwaListResponse<Country>> {

        return this.tenant$.pipe(

            switchMap(tenant => this.listExec(tenant, `${hostURL}/countries-base`, params, this.validQueryKeys))
        );
    }

    create(data: Country): Observable<PwaDocument<Country>> {

        return this.tenant$.pipe(

            switchMap(tenant => this.collectionAPI.post(tenant, `${hostURL}/countries-base`, data))
        );
    }

    update(data: Country): Observable<PwaDocument<Country>> {

        return this.tenant$.pipe(

            switchMap(tenant => this.collectionAPI.put(tenant, `${hostURL}/countries-base/${data.id}`, data))
        );
    }

    delete(id: string): Observable<boolean | PwaDocument<Country>> {

        return this.tenant$.pipe(

            switchMap(tenant => this.collectionAPI.delete(tenant, `${hostURL}/countries-base/${id}`))
        );
    }

    getTableLoadMoreDatabase(limit=20): TableLoadMoreDatabase<Country> {

        return new TableLoadMoreDatabase(this, limit);
    }

    getTreeLoadMoreDatabase(limit=20): TreeLoadMoreDatabase<Country> {

        return new TreeLoadMoreDatabase(this, {}, limit);
    }
}
