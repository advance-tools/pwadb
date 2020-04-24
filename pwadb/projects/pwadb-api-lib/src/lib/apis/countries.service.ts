import { PwaCollectionAPI, PwaDocument, PwaListResponse, DatabaseService, Database, ReactiveDatabase } from 'pwadb-lib';
import { Country, MyDatabase, Collections, hostURL } from '../resources/schema.resource';
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { DatabaseService as APIDatabaseService } from './database.service';
import { Observable } from 'rxjs';
import { ProfileApiService } from './profile.service';

@Injectable({
    providedIn: 'root',
})
export class CountriesApiService extends PwaCollectionAPI<Country, MyDatabase> implements DatabaseService<Country> {

    validQueryKeys = [
        'order_by',
        'filter:created_at',
        'filter:created_at.gte',
        'filter:created_at.lte',
        'filter:created_at.gt',
        'filter:created_at.lt',
        'filter:created_at.range',

        'filter:updated_at',
        'filter:updated_at.gte',
        'filter:updated_at.lte',
        'filter:updated_at.gt',
        'filter:updated_at.lt',
        'filter:updated_at.range',

        'name',
        'name.iexact',
        'name.exact',
        'name.icontains',
        'name.contains',
        'name.in',
        'name.isnull',
        'name.startswith',
        'name.endswith',
    ];

    constructor(private dbService: APIDatabaseService, private httpService: HttpClient, private profileService: ProfileApiService) {

        super(Collections.country, dbService.db$, httpService);

    }

    retrieve(id: string, params?: HttpParams): Observable<PwaDocument<Country>> {

        return this.get(this.profileService.id, `${hostURL}/countries-base/${id}`, params)
    }

    retrieveReactive(id: string, params?: HttpParams): Observable<PwaDocument<Country>> {

        return this.getReactive(this.profileService.id, `${hostURL}/countries-base/${id}`, params)
    }

    fetch(params?: HttpParams): Observable<PwaListResponse<Country>> {

        return this.list(this.profileService.id, `${hostURL}/countries-base`, params, this.validQueryKeys)
    }

    fetchReactive(params?: HttpParams): Observable<PwaListResponse<Country>> {

        return this.listReactive(this.profileService.id, `${hostURL}/countries-base`, params, this.validQueryKeys)
    }

    create(data: Country): Observable<PwaDocument<Country>> {

        return this.collectionAPI.post(this.profileService.id, `${hostURL}/countries-base`, data)
    }

    update(data: Country): Observable<PwaDocument<Country>> {

        return this.collectionAPI.put(this.profileService.id, `${hostURL}/countries-base/${data.id}`, data)
    }

    delete(id: string): Observable<boolean | PwaDocument<Country>> {

        return this.collectionAPI.delete(this.profileService.id, `${hostURL}/countries-base/${id}`)
    }

    getDatabase(limit=20): Database<Country> {

        return new Database(this, limit);
    }

    getReactiveDatabase(limit=20): ReactiveDatabase<Country> {

        return new ReactiveDatabase(this, limit);
    }
}
