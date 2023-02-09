import { HttpParams } from "@angular/common/http";
import { BehaviorSubject, distinctUntilChanged, filter, Observable, Subscription, switchMap, tap } from "rxjs";
import { WebSocketSubject } from "rxjs/webSocket";
import { Datatype, PwaDocument } from "../definitions/document";
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
    retrieve: (id: string, params?: HttpParams) => Observable<PwaDocument<any>>,
    retrieveReactive: (id: string, params?: HttpParams) => Observable<PwaDocument<any>>,
}

export class SocketOperation<T extends Datatype, Database> {

    private subs = new Subscription();

    constructor(
        public entity: string,
        public apiService: WebsocketService<T, Database>,
        public websocketNotificationService: WebsocketNotificationService
    ) {

        const subs = websocketNotificationService.getEntityMessage(entity).pipe(

            // emit distinct output when record_id and operation changes
            distinctUntilChanged((prev, cur) => prev?.record_id === cur.record_id && prev?.operation === cur.operation),

            switchMap(v => {

                return apiService.collectionAPI.collection$.pipe(

                    // find the data in collection
                    switchMap(col => col.findOne({selector: {id: {eq: v.record_id}}}).exec()),

                    // filter out emit if data is not present
                    filter(doc => !!doc),

                    switchMap(doc => {

                        console.log('filtered emit', v, doc.toMutableJSON().data)

                        switch (v.operation) {

                            case 'DELETE': {

                                // remove document if exists
                                return doc.remove();
                            }

                            default: {

                                // retrieve data for latest changes
                                return apiService.retrieve(doc.data.id);
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

//////////////////////////
// Socket Op Without ID
//////////////////////////
export interface WebsocketWithoutIdService<T extends Datatype, Database> extends PwaCollectionAPI<T, Database> {
    retrieve: (params?: HttpParams) => Observable<PwaDocument<any>>,
    retrieveReactive: (params?: HttpParams) => Observable<PwaDocument<any>>,
}

export class SocketOperationWithoutId<T extends Datatype, Database> {

    private subs = new Subscription();

    constructor(
        public entity: string,
        public apiService: WebsocketWithoutIdService<T, Database>,
        public websocketNotificationService: WebsocketNotificationService
    ) {

        const subs = websocketNotificationService.getEntityMessage(entity).pipe(

            tap(v => console.log('socket operation before distinctUntilChanged', v)),

            // emit distinct output when record_id and operation changes
            distinctUntilChanged((prev, cur) => prev?.record_id === cur.record_id && prev?.operation === cur.operation),

            tap(v => console.log('socket operation after distinctUntilChanged', v)),

            switchMap(v => {

                return apiService.collectionAPI.collection$.pipe(

                    // find the data in collection
                    switchMap(col => col.findOne({selector: {id: {eq: v.record_id}}}).exec()),

                    // filter out emit if data is not present
                    filter(doc => !!doc),

                    switchMap(doc => {

                        console.log('filtered emit', v, doc.toMutableJSON().data)

                        switch (v.operation) {

                            case 'DELETE': {

                                // remove document if exists
                                return doc.remove();
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
