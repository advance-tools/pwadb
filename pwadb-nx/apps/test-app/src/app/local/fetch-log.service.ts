import { CollectionAPI, Database, PwaDocument, PwaListResponse, ReactiveDatabase } from "@advance-tools/pwadb-lib";
import { HttpParams } from "@angular/common/http";
import { Injectable, NgZone } from "@angular/core";
import { Guid } from "guid-typescript";
import { Observable, of, switchMap } from "rxjs";
import { AuthCollections, CRMAuthDatabase } from "../resources/collection.resource";
import { FetchLog } from "../resources/schema.resource";
import { DatabaseService } from "./database.service";

@Injectable({
    providedIn: 'root'
})
export class FetchLogService extends CollectionAPI<FetchLog, CRMAuthDatabase> {

    validQueryKeys = [];
    hostURL: string;

    constructor(
        private dbService: DatabaseService,
        private ngZone: NgZone,
    ) {

        super({name: AuthCollections.fetchLog, db$: dbService.db$, ngZone});

        this.hostURL = '/local/fetchLog';
    }

    retrieve(id: string): Observable<PwaDocument<FetchLog>> {

        return this.get('root', `${this.hostURL}/${id}`)
    }

    retrieveReactive(id: string): Observable<PwaDocument<FetchLog>> {

        return this.getReactive('root', `${this.hostURL}/${id}`);

    }

    fetch(params?: HttpParams): Observable<PwaListResponse<FetchLog>> {

        return this.list('root', this.hostURL, params, this.validQueryKeys);

    }

    fetchReactive(params?: HttpParams): Observable<PwaListResponse<FetchLog>> {

        return this.listReactive('root', this.hostURL, params, this.validQueryKeys);

    }

    create(data: FetchLog): Observable<PwaDocument<FetchLog>> {

        return this.post('root', `${this.hostURL}`, data);
    }

    update(data: FetchLog): Observable<PwaDocument<FetchLog>> {

        return this.put('root', `${this.hostURL}/${data.id}`, data);
    }

    override delete(id: string): Observable<PwaDocument<FetchLog>> {

        return super.delete('root', `${this.hostURL}/${id}`);
    }

    override deleteConflict(id: string): Observable<PwaDocument<FetchLog>> {

        return super.deleteConflict('root', `${this.hostURL}/${id}`);
    }

    override createNew(id: string): Observable<PwaDocument<FetchLog>> {

        return super.createNew('root', `${this.hostURL}/${id}`);
    }

    createOrUpdate(id: string): Observable<PwaDocument<FetchLog>> {

        return this.retrieve(id).pipe(

            switchMap(doc => doc ? this.update({id, hash: Guid.create().toString()}) : this.create({id, hash: Guid.create().toString()})),
        );
    }

    retrieveOrCreate(id: string): Observable<PwaDocument<FetchLog>> {

        return this.retrieve(id).pipe(

            switchMap(doc => doc ? of(doc) : this.create({id, hash: Guid.create().toString()}))
        );
    }

    ///////////////
    // Table
    ///////////////

    getDatabase(limit = 20): Database<FetchLog> {

        return new Database(this, this.ngZone, limit);
    }

    getReactiveDatabase(limit = 20): ReactiveDatabase<FetchLog> {

        return new ReactiveDatabase(this, this.ngZone, limit);
    }
}
