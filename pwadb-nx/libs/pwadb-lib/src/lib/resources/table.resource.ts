import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { Datatype, PwaDocument } from '../definitions/document';
import { HttpParams } from '@angular/common/http';
import { PwaListResponse } from '../definitions/collection';
import { switchMap, tap, shareReplay, map, filter, auditTime, distinctUntilChanged, debounceTime, finalize } from 'rxjs/operators';
import { NgZone } from '@angular/core';
import { enterZone } from './operators.resource';
import { CustomHttpParams } from './customParams.resource';
import { flatten } from './misc.resource';

/////////////////////
// Interfaces
/////////////////////

export interface TableDatabase<T extends TableDataType> {
    fetch: (params?: HttpParams) => Observable<PwaListResponse<T>>;
    fetchReactive: (params?: HttpParams) => Observable<PwaListResponse<T>>;
    getDatabase?: (limit?: number) => Database<T>;
    getReactiveDatabase?: (limit?: number) => ReactiveDatabase<T>;
}

export interface IBaseDatabase {
    reset: () => void;
    loadMore: () => void;
}

export interface TableDataType extends Datatype {
    created_at?: string;
}

///////////////////
// Tables
///////////////////

export class BaseDatabase<T extends TableDataType> implements IBaseDatabase {

    queue: Observable<PwaListResponse<T>>[] = []
    queueChange: BehaviorSubject<boolean>;
    data: PwaDocument<T>[];

    _isLoadingChange: BehaviorSubject<boolean>;
    isLoadingChange: Observable<boolean>;
    lastRes: PwaListResponse<T> | null = null;

    // tslint:disable-next-line: variable-name
    private _httpParams: HttpParams;
    private _orderingFlag = false;

    get orderingFlag(): boolean {

        return this._orderingFlag;
    }

    set orderingFlag(v: boolean) {

        if (this._orderingFlag === v) return;

        this._orderingFlag = v;

        this.reset();
    }

    get httpParams() { return this._httpParams; }
    set httpParams(v: HttpParams) {

        this._httpParams = v;

        this.reset();
    }

    get isLoading() { return this._isLoadingChange.value; }
    get offset() { return this.data.length; }
    get isLoadable(): boolean { return !!this.lastRes?.next; }
    get limit() { return this.__limit; }

    constructor(private __limit: number, private __zone: NgZone) {

        this.data               = [];
        this.queueChange        = new BehaviorSubject<boolean>(false);
        this._isLoadingChange 	= new BehaviorSubject<boolean>(false);

        this._httpParams        = new CustomHttpParams();

        this.isLoadingChange    = this._isLoadingChange.asObservable().pipe(

            distinctUntilChanged(),

            enterZone(this.__zone)
        );
    }

    reset() {

        this._httpParams = this.httpParams.delete('cursor');
        this._httpParams = this.httpParams.set('offset', '0');
        this._httpParams = this.httpParams.set('limit', this.limit.toString());

        if (this.orderingFlag && !this.httpParams.has('ordering')) { this._httpParams = this.httpParams.set('ordering', '-created_at'); }
    }

    loadMore() {

        // set queryparams from next url
        if (this.lastRes?.next) {

            const split = this.lastRes.next.split('?');

            if (split.length > 1) {

                split[1].split('&').forEach(q => {

                    const queryParam = q.split('=');

                    this._httpParams = this.httpParams.set(decodeURIComponent(queryParam[0]), decodeURIComponent(queryParam[1]));
                });
            }
        }

        this._httpParams = this.httpParams.set('offset', this.offset.toString());
        this._httpParams = this.httpParams.set('limit', this.limit.toString());
    }

}

export class Database<T extends TableDataType> extends BaseDatabase<T> {

    loadMoreTrigger = new BehaviorSubject<boolean>(false);

    dataChange: Observable<PwaDocument<T>[]>;

    constructor(private apiService: TableDatabase<T>, private zone: NgZone, private _limit = 20) {

        super(_limit, zone);

        this.dataChange = this.queueChange.asObservable().pipe(

            filter(() => !this.isLoading && this.isLoadable),

            debounceTime(300),

            map(() => {

                super.loadMore();

                // make view
                const view = this.getView(this.httpParams);

                // push to queue
                this.queue = [...this.queue, view];

                return this.queue;
            }),

            tap(v => { if (!v.length) { this.reset(); } }),

            filter(v => !!v.length),

            tap(() => this._isLoadingChange.next(true)),

            switchMap(v => combineLatest(v)),

            auditTime(1000/60),

            tap(res => this.lastRes = res.length > 0 ? res[res.length - 1] : null),

            map(res => flatten(res.map(v => v.results)) as PwaDocument<T>[]),

            tap(v => this.data = v),

            tap(() => this._isLoadingChange.next(false)),

            shareReplay(1),

        ) as Observable<PwaDocument<T>[]>;
    }

    getView(httpParams: HttpParams): Observable<PwaListResponse<T>> {

        return this.apiService.fetch(httpParams).pipe(

            shareReplay(1)
        );
    }

    override reset() {

        super.reset();

        // make view
        const view = this.getView(this.httpParams);

        // push to queue
        this.queue = [view];

        this.queueChange.next(true);
    }

    override loadMore() {

        this.queueChange.next(true);
    }

}


export class ReactiveDatabase<T extends TableDataType> extends BaseDatabase<T> {

    dataChange: Observable<PwaDocument<T>[]>;

    constructor(private apiService: TableDatabase<T>, private zone: NgZone, private _limit = 20) {

        super(_limit, zone);

        this.dataChange = this.queueChange.asObservable().pipe(

            filter(() => !this.isLoading && this.isLoadable),

            debounceTime(300),

            map(() => {

                super.loadMore();

                // make view
                const view = this.getView(this.httpParams);

                // push to queue
                this.queue = [...this.queue, view];

                return this.queue;
            }),

            tap(v => { if (!v.length) { this.reset(); } }),

            filter(v => !!v.length),

            tap(() => this._isLoadingChange.next(true)),

            switchMap(v => combineLatest(v)),

            auditTime(1000/60),

            tap(res => this.lastRes = res.length > 0 ? res[res.length - 1] : null),

            map(res => flatten(res.map(v => v.results)) as PwaDocument<T>[]),

            tap(v => this.data = v),

            tap(() => this._isLoadingChange.next(false)),

            shareReplay(1),

        ) as Observable<PwaDocument<T>[]>;
    }

    getView(httpParams: HttpParams): Observable<PwaListResponse<T>> {

        return this.apiService.fetchReactive(httpParams).pipe(

            shareReplay(1)
        );
    }

    override reset() {

        super.reset();

        // make view
        const view = this.getView(this.httpParams);

        // push to queue
        this.queue = [view];

        this.queueChange.next(true);
    }

    override loadMore() {

        this.queueChange.next(true);
    }
}
