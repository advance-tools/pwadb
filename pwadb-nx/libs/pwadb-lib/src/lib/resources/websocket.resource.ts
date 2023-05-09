import { HttpParams } from "@angular/common/http";
import { MangoQuery } from "rxdb";
import { BehaviorSubject, buffer, concat, concatMap, debounceTime, filter, Observable, shareReplay, Subscription, switchMap, take } from "rxjs";
import { WebSocketSubject } from "rxjs/webSocket";
import { PwaListResponse } from "../definitions/collection";
import { Datatype, PwaDocType, PwaDocument } from "../definitions/document";
import { PwaCollectionAPI } from "./collection.resource";

export interface WebsocketNotification {
    record_id: string,
    entity: string,
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
}

//////////////////
// Socket Service
//////////////////

export abstract class WebsocketNotificationService {
    socketChange: BehaviorSubject<WebSocketSubject<WebsocketNotification>>;
    getEntityMessage: (entity: string) => Observable<WebsocketNotification>;
}

/////////////////
// Socket Op
/////////////////
export interface WebsocketService<T extends Datatype, Database> extends PwaCollectionAPI<T, Database> {
    // retrieve: (id: string, params?: HttpParams) => Observable<PwaDocument<any>>,
    // retrieveReactive: (id: string, params?: HttpParams) => Observable<PwaDocument<any>>,
    fetch: (params?: HttpParams) => Observable<PwaListResponse<any>>,
    // fetchReactive: (params?: HttpParams) => Observable<PwaListResponse<any>>,
}

export class SocketOperation<T extends Datatype, Database> {

    fetchIds = new BehaviorSubject<string[]>([]);
    private subs = new Subscription();

    constructor(
        public entity: string,
        public apiService: WebsocketService<T, Database>,
        public websocketNotificationService: WebsocketNotificationService
    ) {

        const entityMessage = websocketNotificationService.getEntityMessage(entity).pipe(

            shareReplay(1),
        );

        const subs = entityMessage.pipe(

            // buffer until
            buffer(entityMessage.pipe(debounceTime(3000))),

            concatMap(v => {

                return apiService.collectionAPI.collection$.pipe(

                    take(1),

                    switchMap(col => {

                        // delete observables
                        const deleteOps = v.filter(o => o.operation === 'DELETE')
                                            .map(o => col.find({selector: {tenantUrl: {$regex: new RegExp(`.*${o.record_id}`)}}} as MangoQuery<PwaDocType<T>>).remove());

                        // fetch observables
                        const ids = v.filter(o => o.operation !== 'DELETE').map(o => o.record_id);
                        const fetchOps = apiService.fetch(new HttpParams().set('id.in', ids.join(',')));

                        return concat(...[].concat(deleteOps, ids.length > 0 ? [fetchOps] : []));
                    }),
                );
            })

        ).subscribe();

        this.subs.add(subs);
    }

    unsubscribe() {

        this.subs.unsubscribe();
    }
}

//////////////////////////
// Socket Op Without ID
//////////////////////////
export interface WebsocketWithoutIdService<T extends Datatype, Database> extends PwaCollectionAPI<T, Database> {
    retrieve: (params?: HttpParams) => Observable<PwaDocument<any>>,
    // retrieveReactive: (params?: HttpParams) => Observable<PwaDocument<any>>,
}

export class SocketOperationWithoutId<T extends Datatype, Database> {

    private subs = new Subscription();

    constructor(
        public entity: string,
        public apiService: WebsocketWithoutIdService<T, Database>,
        public websocketNotificationService: WebsocketNotificationService
    ) {

        const subs = websocketNotificationService.getEntityMessage(entity).pipe(

            concatMap(v => {

                return apiService.collectionAPI.collection$.pipe(

                    take(1),

                    // find the data in collection
                    switchMap(col => col.findOne({selector: { tenantUrl: {$regex: new RegExp(`.*${v.record_id}`)}}} as MangoQuery<PwaDocType<T>>).exec()),

                    // filter out emit if data is not present
                    filter(doc => !!doc),

                    switchMap(doc => {

                        switch (v.operation) {

                            case 'DELETE': {

                                // remove document if exists
                                return doc.incrementalRemove();
                            }

                            default: {

                                // retrieve data for latest changes
                                return apiService.retrieve();
                            }
                        }
                    })
                );
            }),

        ).subscribe();

        this.subs.add(subs);
    }

    unsubscribe() {

        this.subs.unsubscribe();
    }
}
