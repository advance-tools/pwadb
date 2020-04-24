import { BehaviorSubject, Observable, Subscription, combineLatest, Subject } from 'rxjs';
import { PwaDocument } from '../definitions/document';
import { HttpParams } from '@angular/common/http';
import { PwaListResponse } from '../definitions/collection';
import { switchMap, tap, filter, debounceTime, shareReplay} from 'rxjs/operators';

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

	// getTreeLoadMoreDatabase?: (limit?: number) => TreeLoadMoreDatabase<T>;
}

export const LOAD_MORE = 'LOAD_MORE';

export interface IBaseDatabase {
	reset: () => void;
	refresh: () => void;
	initialise: () => void;
	loadMore: () => void;
	stop: () => void;
}

export class BaseDatabase<T extends DatabaseDatatype> implements IBaseDatabase {

	dataChange: BehaviorSubject<PwaDocument<T>[]>;
	isLoadingChange: BehaviorSubject<boolean>;
	totalCount = 0;
	subs: Subscription;

	private _firstTime = true;
	private _httpParams: HttpParams;

	get data() { return this.dataChange.value; }
	set data(v: PwaDocument<T>[]) { this.dataChange.next(v); }

	get httpParams() { return this._httpParams; }
	set httpParams(v: HttpParams) {

		this._httpParams = v;

		if (!this._firstTime) this.refresh();
	}

	get isLoading() { return this.isLoadingChange.value; }
	get offset() { return this.data.length; }
	get isLoadable(): boolean { return this.offset < this.totalCount || (this.offset === this.totalCount && this._firstTime); }

	constructor(private limit: number) {

		this.dataChange 		= new BehaviorSubject([]);
		this.isLoadingChange 	= new BehaviorSubject(false);

		this._httpParams = new HttpParams();

		this.subs = new Subscription();
	}

	initialise() {

		this._firstTime = true;

		this.loadMore();

		this._firstTime = false;
	}

	reset() {

		this.data = [];

		this.initialise();
	}

	refresh() {

		this._httpParams = this.httpParams.set('offset', '0');
		this._httpParams = this.httpParams.set('limit', this.offset.toString());

		if (!this.httpParams.has('order_by')) this._httpParams = this.httpParams.set('order_by', 'updated_at');

		this.data = [];
	}

	loadMore() {

		this._httpParams = this.httpParams.set('offset', this.offset.toString());
		this._httpParams = this.httpParams.set('limit', this.limit.toString());

		if (!this.httpParams.has('order_by')) this._httpParams = this.httpParams.set('order_by', 'updated_at');
	}

	stop() {

		this.subs.unsubscribe();
	}
}

///////////////////////////
// Table
//////////////////////////

export class Database<T extends DatabaseDatatype> extends BaseDatabase<T> {

	private queueChange: Subject<HttpParams>;

	constructor(private apiService: DatabaseService<T>, private _limit = 100) {

		super(_limit);
	
		this.queueChange = new Subject();

		const subs = this.queueChange.pipe(

			tap(() => this.isLoadingChange.next(true)),

			switchMap(httpParams => this.apiService.fetch(httpParams)),
			
		).subscribe(res => {

			if (!this.isLoading) this.isLoadingChange.next(true);

			this.totalCount = res.count;

			this.data = this.data.concat(res.results);

			this.isLoadingChange.next(false);
		});

		this.subs.add(subs);
	}

	refresh() {

		if (this.isLoading) return;

		super.refresh();

		this.queueChange.next(this.httpParams);
	}

	loadMore() {

		if (!this.isLoadable || this.isLoading) return;

		super.loadMore();

		this.queueChange.next(this.httpParams);
	}

}


export class ReactiveDatabase<T extends DatabaseDatatype> extends BaseDatabase<T> {

	private queueChange: BehaviorSubject<Observable<PwaListResponse<T>>[]>;
	private params: HttpParams[];

	get queue() { return this.queueChange.value; }
	set queue(v: Observable<PwaListResponse<T>>[]) { this.queueChange.next(v); }

	constructor(private apiService: DatabaseService<T>, private _limit = 100) {

		super(_limit);
	
		this.queueChange = new BehaviorSubject([]);

		this.params = [];

		const subs = this.queueChange.pipe(

			tap(v => this.isLoadingChange.next(v.length > 0)),

			filter(v => v.length > 0),

			switchMap(v => combineLatest(v)),

			debounceTime(10),

		).subscribe(res => {

			if (!this.isLoading) this.isLoadingChange.next(true);

			this.totalCount = res.length > 0 ? res[res.length - 1].count : 0;

			this.data = res.reduce((acc, cur) => acc.concat(cur.results), []);

			this.isLoadingChange.next(false);
		});

		this.subs.add(subs);
	}

	getView(httpParams: HttpParams) {

		return this.apiService.fetchReactive(httpParams).pipe(

			shareReplay(1)
		);
	}

	reset() {

		this.queue = [];

		this.params = [];

		super.reset();
	}

	refresh() {

		if (this.isLoading) return;

		super.refresh();

		// refresh params
		this.params = this.params.map(v => this.httpParams.set('offset', v.get('offset')).set('limit', v.get('limit')))

		// refresh all views
		this.queue = this.params.map(v => this.getView(v));
	}

	loadMore() {

		if (!this.isLoadable || this.isLoading) return;

		super.loadMore();

		// add params to list
		this.params.push(this.httpParams);

		// make view
		const view = this.getView(this.httpParams);

		// push to queue
		this.queue = [].concat(this.queue, [view]);
	}

}

///////////////////////////
// Tree
///////////////////////////

// /** Flat node with expandable and level information */
// export class LoadMoreFlatNode<T extends DatabaseDatatype> {
//     constructor(
//         public doc: PwaDocument<T> | string,
//         public level = 1,
// 		public expandable = false,
// 		public database: TreeLoadMoreDatabase<T>,
//     ) {}
// }

// export type TreeMap<T extends DatabaseDatatype> = Map<string | PwaDocument<T>, TreeLoadMoreDatabase<T> | TreeMap<any>[]>;

// export interface DatabaseInformation<T extends DatabaseDatatype> {
// 	apiService: DatabaseService<T>;
// 	onCreation: (parentDoc: PwaDocument<T>, db: TreeLoadMoreDatabase<T>, params: HttpParams) => void
// }

// export interface ChildTreeInformation<T extends DatabaseDatatype> {
// 	[key: string]: DatabaseInformation<T>;
// }

// export class TreeLoadMoreDatabase<T extends DatabaseDatatype> extends TableDatabase<T> {

// 	dataMapChange: BehaviorSubject<TreeMap<T>>;

//     get dataMap() { return this.dataMapChange.value; }
// 	set dataMap(v: TreeMap<T>) { this.dataMapChange.next(v); }

//     constructor(
//       private _apiService: DatabaseService<T>,
//       private childTreeInfo: ChildTreeInformation<any>,
//       private _limit = 100
//     ) {

// 		super(_apiService, _limit);

// 		this.dataMapChange = new BehaviorSubject(new Map());

// 		const subs = this.dataChange.pipe(

// 			switchMap(docs => from(docs)),

// 			filter(doc => typeof doc !== 'string' && !this.dataMap.has(doc)),

// 			switchMap((doc: PwaDocument<T>) => {

// 				// create databases for each document
// 				const childDatabases = Object.keys(this.childTreeInfo).map(k => {

// 					const db = this.childTreeInfo[k].apiService.getTreeLoadMoreDatabase();

// 					// extract http params
// 					const keys = this.httpParams.keys().filter(k => k.includes(`${k}_`));

// 					let childParams = new HttpParams();

// 					keys.forEach(k => childParams = childParams.set(k.split(`${k}_`)[1], this.httpParams.get(k)));

// 					// do on-creation for each childDatabase
// 					this.childTreeInfo[k].onCreation(doc, db, childParams);

// 					return db;
// 				});

// 				return combineLatest(childDatabases.map(v => v.dataMapChange)).pipe(

// 					map(maps => ({doc, maps}))

// 				);
// 			}),

// 		).subscribe(v => {

// 			this.dataMap.set(v.doc, v.maps)

// 			if (this.isLoadable) {

// 				this.dataMap.set(LOAD_MORE, this);

// 			} else {

// 				this.dataMap.delete(LOAD_MORE);
// 			}

// 			this.dataMap = this.dataMap;
// 		});

// 		this._apiService.subs.add(subs);

// 	}

// 	reset() {

// 		this.dataMap = new Map();

// 		super.reset();
// 	}

// }
