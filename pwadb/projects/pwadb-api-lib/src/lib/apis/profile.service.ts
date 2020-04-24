import { PwaCollectionAPI, PwaDocument, CollectionListResponse } from 'pwadb-lib';
import { Profile, MyDatabase, Collections, hostURL } from '../resources/schema.resource';
import { DatabaseService } from './database.service';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class ProfileApiService extends PwaCollectionAPI<Profile, MyDatabase> {

    tenant = 'root'
    validQueryKeys = []

    idChange: BehaviorSubject<string>;

    get id() { return this.idChange.value; }
    set id(v: string) { this.idChange.next(v); }

    constructor(private dbService: DatabaseService, private httpService: HttpClient) {

        super(Collections.tenant, dbService.db$, httpService);

        this.idChange = new BehaviorSubject('');
    }

    retrieve(params?: HttpParams): Observable<PwaDocument<Profile>> {

        return this.get(this.tenant, `${hostURL}/profile/${this.id}`, params)
    }

    retrieveReactive(params?: HttpParams): Observable<PwaDocument<Profile>> {

        return this.getReactive(this.tenant, `${hostURL}/profile/${this.id}`, params)
    }

    fetch(params?: HttpParams): Observable<CollectionListResponse<Profile>> {

        return this.collectionAPI.list(this.tenant, `${hostURL}/profile`, params, this.validQueryKeys);
    }

    fetchReactive(params?: HttpParams): Observable<CollectionListResponse<Profile>> {

        return this.collectionAPI.listReactive(this.tenant, `${hostURL}/profile`, params, this.validQueryKeys);
    }

    create(data: Profile): Observable<PwaDocument<Profile>> {

        return this.collectionAPI.post(this.tenant, `${hostURL}/profile`, data);
    }

    update(data: Profile): Observable<PwaDocument<Profile>> {

        return this.collectionAPI.put(this.tenant, `${hostURL}/profile/${data.id}`, data);
    }

    delete(): Observable<boolean | PwaDocument<Profile>> {

        return this.collectionAPI.delete(this.tenant, `${hostURL}/profile/${this.id}`)
    }
}