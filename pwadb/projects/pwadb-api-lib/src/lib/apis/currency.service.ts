import { PwaCollectionAPI, PwaDocument, PwaListResponse, Database, ReactiveDatabase } from 'pwadb-lib';
import { MyDatabase, Currency, Collections, hostURL } from '../resources/schema.resource';
import { DatabaseService as APIDatabaseService } from './database.service';
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ProfileApiService } from './profile.service';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class CurrencyApiService extends PwaCollectionAPI<Currency, MyDatabase> {

    validQueryKeys = [
        'id',

        'name',
        'name.iexact',
        'name.exact',
        'name.icontains',
        'name.contains',
        'name.in',
        'name.isnull',
        'name.startswith',
        'name.endswith',
    ]

    constructor(private dbService: APIDatabaseService, private httpService: HttpClient, private profileService: ProfileApiService) {

        super(Collections.currency, dbService.db$, httpService);

    }

    retrieve(id: string, params?: HttpParams): Observable<PwaDocument<Currency>> {

        return this.get(this.profileService.id, `${hostURL}/currency-base/${id}`, params)
    }

    retrieveReactive(id: string, params?: HttpParams): Observable<PwaDocument<Currency>> {

        return this.getReactive(this.profileService.id, `${hostURL}/currency-base/${id}`, params)
    }

    fetch(params?: HttpParams): Observable<PwaListResponse<Currency>> {

        return this.list(this.profileService.id, `${hostURL}/currency-base`, params, this.validQueryKeys)
    }

    fetchReactive(params?: HttpParams): Observable<PwaListResponse<Currency>> {

        return this.listReactive(this.profileService.id, `${hostURL}/currency-base`, params, this.validQueryKeys)
    }

    create(data: Currency): Observable<PwaDocument<Currency>> {

        return this.collectionAPI.post(this.profileService.id, `${hostURL}/currency-base`, data)
    }

    update(data: Currency): Observable<PwaDocument<Currency>> {

        return this.collectionAPI.put(this.profileService.id, `${hostURL}/currency-base/${data.id}`, data)
    }

    delete(id: string): Observable<boolean | PwaDocument<Currency>> {

        return this.collectionAPI.delete(this.profileService.id, `${hostURL}/currency-base/${id}`)
    }

    getDatabase(limit=20): Database<Currency> {

        return new Database(this, limit);
    }

    getReactiveDatabase(limit=20): ReactiveDatabase<Currency> {

        return new ReactiveDatabase(this, limit);
    }
}
