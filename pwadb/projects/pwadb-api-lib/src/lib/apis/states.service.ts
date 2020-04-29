import { PwaCollectionAPI, PwaDocument, PwaListResponse, DatabaseService, Database, ReactiveDatabase } from 'pwadb-lib';
import { MyDatabase, Collections, hostURL, State } from '../resources/schema.resource';
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { DatabaseService as APIDatabaseService } from './database.service';
import { Observable } from 'rxjs';
import { ProfileApiService } from './profile.service';
import { CitiesApiService } from './cities.service';

@Injectable({
    providedIn: 'root',
})
export class StatesApiService extends PwaCollectionAPI<State, MyDatabase> implements DatabaseService<State> {

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

        'my_country_id',

        'exclude:id',
    ];

    constructor(
        private dbService: APIDatabaseService,
        private httpService: HttpClient,
        private profileService: ProfileApiService,
    ) {

        super(Collections.states, dbService.db$, httpService);

    }

    retrieve(id: string, params?: HttpParams): Observable<PwaDocument<State>> {

        return this.get(this.profileService.id, `${hostURL}/states-base/${id}`, params)
    }

    retrieveReactive(id: string, params?: HttpParams): Observable<PwaDocument<State>> {

        return this.getReactive(this.profileService.id, `${hostURL}/states-base/${id}`, params)
    }

    fetch(params?: HttpParams): Observable<PwaListResponse<State>> {

        return this.list(this.profileService.id, `${hostURL}/states-base`, params, this.validQueryKeys)
    }

    fetchReactive(params?: HttpParams): Observable<PwaListResponse<State>> {

        return this.listReactive(this.profileService.id, `${hostURL}/states-base`, params, this.validQueryKeys)
    }

    create(data: State): Observable<PwaDocument<State>> {

        return this.collectionAPI.post(this.profileService.id, `${hostURL}/states-base`, data)
    }

    update(data: State): Observable<PwaDocument<State>> {

        return this.collectionAPI.put(this.profileService.id, `${hostURL}/states-base/${data.id}`, data)
    }

    delete(id: string): Observable<boolean | PwaDocument<State>> {

        return this.collectionAPI.delete(this.profileService.id, `${hostURL}/states-base/${id}`)
    }

    /////////////////
    // Table
    /////////////////

    getDatabase(limit=20): Database<State> {

        return new Database(this, limit);
    }

    getReactiveDatabase(limit=20): ReactiveDatabase<State> {

        return new ReactiveDatabase(this, limit);
    }

}
