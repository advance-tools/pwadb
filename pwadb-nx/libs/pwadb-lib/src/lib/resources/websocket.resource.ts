import { OnDestroy } from "@angular/core";
import { Observable, Subscription } from "rxjs";
import { WebSocketSubject } from "rxjs/webSocket";


export abstract class WebsocketService<WebsocketEvent> implements OnDestroy {

    socket: WebSocketSubject<WebsocketEvent>;
    private subs: Subscription;

    getEntityMessage: (entity: string) => Observable<WebsocketEvent>;
    ngOnDestroy: () => any;
}
