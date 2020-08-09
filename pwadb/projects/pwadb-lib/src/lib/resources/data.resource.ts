import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { PwaDocument } from '../definitions/document';
import { HttpParams } from '@angular/common/http';
import { PwaListResponse } from '../definitions/collection';
import { switchMap, tap, shareReplay, map, filter } from 'rxjs/operators';

/////////////////////
// Interfaces
/////////////////////

export interface DatabaseDatatype {
    id: string;
    updated_at: string;
}

export interface DatabaseService<T extends DatabaseDatatype> {

    fetch: (params?: HttpParams) => Observable<PwaListResponse<T>>;

    fetchReactive: (params?: HttpParams) => Observable<PwaListResponse<T>>;

    getDatabase?: (limit?: number) => Database<T>;

    getReactiveDatabase?: (limit?: number) => ReactiveDatabase<T>;
}

export interface IBaseDatabase {
    reset: () => void;
    loadMore: () => void;
}

export class BaseDatabase<T extends DatabaseDatatype> implements IBaseDatabase {

    queueChange: BehaviorSubject<Observable<PwaListResponse<T>>[]>;
    data: PwaDocument<T>[];

    isLoadingChange: BehaviorSubject<boolean>;
    lastRes: PwaListResponse<T>;

    // tslint:disable-next-line: variable-name
    private _httpParams: HttpParams;

    get httpParams() { return this._httpParams; }
    set httpParams(v: HttpParams) {

        this._httpParams = v;

        this.reset();
    }

    get isLoading() { return this.isLoadingChange.value; }
    get offset() { return this.data.length; }
    get isLoadable(): boolean { return !!this.lastRes?.next; }
    get limit() { return this.__limit; }

    constructor(private __limit: number) {

        this.data               = [];
        this.queueChange        = new BehaviorSubject([]);
        this.isLoadingChange 	= new BehaviorSubject(false);

        this._httpParams        = new HttpParams();
    }

    reset() {

        this._httpParams = this.httpParams.delete('cursor');
        this._httpParams = this.httpParams.set('offset', '0');
        this._httpParams = this.httpParams.set('limit', this.limit.toString());

        if (!this.httpParams.has('ordering')) { this._httpParams = this.httpParams.set('ordering', '-created_at'); }
    }

    loadMore() {

        // set queryparams from next url
        if (this.lastRes?.next) {

            const split = this.lastRes.next.split('?');

            if (split.length > 1) {

                split[1].split('&').forEach(q => {

                    const queryParam = q.split('=');

                    this._httpParams = this.httpParams.set(queryParam[0], queryParam[1]);
                });
            }
        }

        this._httpParams = this.httpParams.set('offset', this.offset.toString());
        this._httpParams = this.httpParams.set('limit', this.limit.toString());

        if (!this.httpParams.has('ordering')) { this._httpParams = this.httpParams.set('ordering', '-created_at'); }

    }

}

///////////////////////////
// Table
//////////////////////////

export class Database<T extends DatabaseDatatype> extends BaseDatabase<T> {

    dataChange: Observable<PwaDocument<T>[]>;

    constructor(private apiService: DatabaseService<T>, private _limit = 20) {

        super(_limit);

        this.dataChange = this.queueChange.asObservable().pipe(

            tap(v => { if (!v.length) { this.reset(); } }),

            filter(v => !!v.length),

            tap(() => this.isLoadingChange.next(true)),

            switchMap(v => combineLatest(v)),

            map(res => {

                // set last response
                this.lastRes = res.length > 0 ? res[res.length - 1] : null;

                // push data
                const data = [];

                Array.prototype.push.apply(data, ...res.map(v => v.results));

                return data;
            }),

            tap(v => this.data = v),

            tap(() => this.isLoadingChange.next(false)),

        );
    }

    getView(httpParams: HttpParams): Observable<PwaListResponse<T>> {

        return this.apiService.fetch(httpParams).pipe(

            shareReplay(1)
        );
    }

    reset() {

        super.reset();

        // make view
        const view = this.getView(this.httpParams);

        // push to queue
        this.queueChange.next([view]);
    }

    loadMore() {

        if (this.isLoading) { return; }

        super.loadMore();

        // make view
        const view = this.getView(this.httpParams);

        // push to queue
        this.queueChange.next([].concat(this.queueChange.value, [view]));
    }

}


export class ReactiveDatabase<T extends DatabaseDatatype> extends BaseDatabase<T> {

    dataChange: Observable<PwaDocument<T>[]>;

    constructor(private apiService: DatabaseService<T>, private _limit = 20) {

        super(_limit);

        this.dataChange = this.queueChange.asObservable().pipe(

            tap(v => { if (!v.length) { this.reset(); } }),

            filter(v => !!v.length),

            tap(() => this.isLoadingChange.next(true)),

            switchMap(v => combineLatest(v)),

            map(res => {

                console.log('reactive database datachange', res);
                // set last response
                this.lastRes = res.length > 0 ? res[res.length - 1] : null;

                // push data
                const data = [];

                Array.prototype.push.apply(data, ...res.map(v => v.results));

                return data;
            }),

            tap(v => this.data = v),

            tap(() => this.isLoadingChange.next(false)),
        );
    }

    getView(httpParams: HttpParams): Observable<PwaListResponse<T>> {

        return this.apiService.fetch(httpParams).pipe(

            shareReplay(1)
        );
    }

    reset() {

        super.reset();

        // make view
        const view = this.getView(this.httpParams);

        // push to queue
        this.queueChange.next([view]);
    }

    loadMore() {

        if (this.isLoading) { return; }

        super.loadMore();

        // make view
        const view = this.getView(this.httpParams);

        // push to queue
        this.queueChange.next([].concat(this.queueChange.value, [view]));
    }
}

///////////////////////////
// Tree
///////////////////////////

export type TreeNode<T extends DatabaseDatatype> = {item: PwaDocument<T>, children: Observable<TreeNode<any>[]>};

export interface DatabaseInformation<T extends DatabaseDatatype> {
    getDatabase: (limit?: number) => Database<T> | ReactiveDatabase<T>;
    onCreationSetup?: (parentDoc: PwaDocument<T> | null, db: Database<T> | ReactiveDatabase<T>, params: HttpParams) => void;
    children: TreeInformation<T>;
}

export interface TreeInformation<T extends DatabaseDatatype> {
    [key: string]: DatabaseInformation<T>;
}

export class TreeDatabase<T extends DatabaseDatatype> {

    childTreeMap: Map<PwaDocument<any>, Observable<TreeNode<any>[]>>;
    databaseMap: Map<PwaDocument<any>, Database<any> | ReactiveDatabase<any>>;

    dataChange: Observable<TreeNode<T>[]>;

    private queueChange: BehaviorSubject<any>;
    // tslint:disable-next-line: variable-name
    private _httpParams: HttpParams;

    get httpParams() { return this._httpParams; }
    set httpParams(v: HttpParams) {

        this._httpParams = v;

        this.reset();
    }

    constructor(private treeInfo: TreeInformation<T>) {

        this.databaseMap  = new Map();
        this.childTreeMap = new Map();
        this._httpParams  = new HttpParams();
        this.queueChange  = new BehaviorSubject(true);

        this.dataChange = this.queueChange.asObservable().pipe(

            switchMap(() => this.buildTree(this.treeInfo, null, this.httpParams)),

        );
    }

    buildTree(treeInfo: TreeInformation<T>, parentDoc: PwaDocument<T> = null, params = new HttpParams()): Observable<TreeNode<T>[]> {

        const treeNodes = Object.keys(treeInfo).map(key => {

            const db = treeInfo[key].getDatabase();

            // extract http params
            const keys = params.keys().filter(pk => pk && pk.includes(`${key}--`));

            // create new params associated to this database
            let childParams = new HttpParams();

            // set params
            keys.forEach(pk => childParams = childParams.set(pk.split(`${key}--`)[1], params.getAll(pk).join(',')));

            // run callback
            treeInfo[key].onCreationSetup ? treeInfo[key].onCreationSetup(parentDoc, db, childParams) : db.httpParams = childParams;

            return db.dataChange.pipe(

                map(docs => {

                    const obs = docs.map(doc => {

                        ///////////////////
                        // Database Map
                        ///////////////////
                        if (!this.databaseMap.has(doc)) { this.databaseMap.set(doc, db); }

                        ///////////////////
                        // Child Tree
                        ///////////////////

                        if (!this.childTreeMap.has(doc)) {

                            const childTree = this.buildTree(treeInfo[key].children, doc, childParams).pipe(

                                shareReplay(1),

                            ) as Observable<TreeNode<any>[]>;

                            this.childTreeMap.set(doc, childTree);
                        }

                        return {item: doc, children: this.childTreeMap.get(doc)} as TreeNode<any>;

                    });

                    return obs;
                }),

            );
        });

        return combineLatest(treeNodes).pipe(

            map(nodes => [].concat(...nodes)),

            // startWith([])

        );
    }

    reset() {

        this.databaseMap  = new Map();
        this.childTreeMap = new Map();

        this.queueChange.next(true);
    }

}

/////////////////////
// DataSource
/////////////////////

/** Flat node with expandable and level information */
export class DynamicFlatNode<T extends DatabaseDatatype> {
    constructor(
        public item: PwaDocument<T> | string,
        public level = 1,
        public expandable = false,
    ) {}
}
