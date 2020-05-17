import { BehaviorSubject, Observable, combineLatest, of } from 'rxjs';
import { PwaDocument } from '../definitions/document';
import { HttpParams } from '@angular/common/http';
import { PwaListResponse } from '../definitions/collection';
import { switchMap, tap, shareReplay, map, startWith, filter} from 'rxjs/operators';

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

	_dataChange: BehaviorSubject<PwaDocument<T>[]>;
	isLoadingChange: BehaviorSubject<boolean>;
	totalCount = 0;

	private _httpParams: HttpParams;

	get data() { return this._dataChange.value; }
	set data(v: PwaDocument<T>[]) { this._dataChange.next(v); }

	get httpParams() { return this._httpParams; }
	set httpParams(v: HttpParams) {

		this._httpParams = v;

		this.reset();
	}

	get isLoading() { return this.isLoadingChange.value; }
	get offset() { return this.data.length; }
	get isLoadable(): boolean { return this.offset < this.totalCount; }
	get limit() { return this.__limit; }

	constructor(private __limit: number) {

		this._dataChange 		= new BehaviorSubject([]);
		this.isLoadingChange 	= new BehaviorSubject(false);

		this._httpParams = new HttpParams();
	}

	reset() {

		this._httpParams = this.httpParams.set('offset', '0');
		this._httpParams = this.httpParams.set('limit', this.limit.toString());

		if (!this.httpParams.has('order_by')) this._httpParams = this.httpParams.set('order_by', '-updated_at');
	}

	loadMore() {

		this._httpParams = this.httpParams.set('offset', this.offset.toString());
		this._httpParams = this.httpParams.set('limit', this.limit.toString());

		if (!this.httpParams.has('order_by')) this._httpParams = this.httpParams.set('order_by', '-updated_at');
	}

}

///////////////////////////
// Table
//////////////////////////

export class Database<T extends DatabaseDatatype> extends BaseDatabase<T> {

	private queueChange: BehaviorSubject<HttpParams>;

	dataChange: Observable<PwaDocument<T>[]>;

	constructor(private apiService: DatabaseService<T>, private _limit = 20) {

		super(_limit);

		this.queueChange = new BehaviorSubject(null);

		this.dataChange = this.queueChange.asObservable().pipe(

			filter(v => !!v),

			startWith(this.httpParams),

			tap(() => this.isLoadingChange.next(true)),

			switchMap(httpParams => this.apiService.fetch(httpParams)),

			tap(res => this.totalCount = res.count),
			
			tap(res => this.data = this.data.concat(res.results)),
			
			tap(() => this.isLoadingChange.next(false)),
			
			map(() => this.data),

		);
	}

	reset() {

		super.reset();

		this.data = [];

		this.queueChange.next(this.httpParams);
	}

	loadMore() {

		if (this.isLoading) return;

		super.loadMore();

		this.queueChange.next(this.httpParams);
	}

}


export class ReactiveDatabase<T extends DatabaseDatatype> extends BaseDatabase<T> {

	private queueChange: BehaviorSubject<Observable<PwaListResponse<T>>[]>;

	dataChange: Observable<PwaDocument<T>[]>

	constructor(private apiService: DatabaseService<T>, private _limit = 20) {

		super(_limit);

		this.queueChange = new BehaviorSubject([]);

		this.dataChange = this.queueChange.asObservable().pipe(

			tap(v => {if(!v.length) this.reset(); }),
  
			filter(v => !!v.length),

			tap(() => this.isLoadingChange.next(true)),

			switchMap(v => combineLatest(v)),

			tap(res => this.totalCount = res.length > 0 ? res[res.length - 1].count : 0),

			tap(res => this.data = [].concat(...res.map(v => v.results))),

			tap(() => this.isLoadingChange.next(false)),
			
			map(() => this.data),

		);
	}

	getView(httpParams: HttpParams) {

		return this.apiService.fetchReactive(httpParams).pipe(

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

		if (this.isLoading) return;

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

export type TreeNode<T extends DatabaseDatatype> = {item: PwaDocument<T>, children: TreeNode<any>[]};

export interface DatabaseInformation<T extends DatabaseDatatype> {
	getDatabase: (limit?: number) => Database<T> | ReactiveDatabase<T>;
	onCreationSetup?: (parentDoc: PwaDocument<T> | null, db: Database<T> | ReactiveDatabase<T>, params: HttpParams) => void;
	children: TreeInformation<T>;
}

export interface TreeInformation<T extends DatabaseDatatype> {
	[key: string]: DatabaseInformation<T>;
}

export class TreeDatabase<T extends DatabaseDatatype> {

	childTreeMap: Map<PwaDocument<T>, Observable<TreeNode<T>>>;
	databaseMap: Map<PwaDocument<T>, Database<T> | ReactiveDatabase<T>>;
	
	dataChange: Observable<TreeNode<T>[]>;
	
	private queueChange: BehaviorSubject<any>;
	private _dataChange: BehaviorSubject<TreeNode<T>[]>;
	private _httpParams: HttpParams;

    get data() { return this._dataChange.value; }
	set data(v: TreeNode<T>[]) { this._dataChange.next(v); }

	get httpParams() { return this._httpParams; }
	set httpParams(v: HttpParams) {

		this._httpParams = v;

		this.reset();
	}

    constructor(private treeInfo: TreeInformation<T>) {

		this.databaseMap  = new Map();
		this.childTreeMap = new Map();
		this._httpParams  = new HttpParams();
		this._dataChange  = new BehaviorSubject([]);
		this.queueChange  = new BehaviorSubject(true);

		this.dataChange = this.queueChange.asObservable().pipe(

			switchMap(() => this.buildTree(this.treeInfo, null, this.httpParams)),

			tap(v => this.data = v),

			map(() => this.data),

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

				switchMap(docs => {

					console.log('httpParams', db.offset, db.limit, db.totalCount, db.data)

					const obs = docs.map(doc => {

						///////////////////
						// Database Map
						///////////////////
						if (!this.databaseMap.has(doc)) this.databaseMap.set(doc, db);

						///////////////////
						// Child Tree
						///////////////////

						if (!this.childTreeMap.has(doc)) {

							const childTree = this.buildTree(treeInfo[key].children, doc, childParams).pipe(

								map(nodes => ({item: doc, children: nodes} as TreeNode<T>)),

								shareReplay(1),

							);

							this.childTreeMap.set(doc, childTree);
						}

						return this.childTreeMap.get(doc);

					});

					return combineLatest(obs);
				}),

				startWith([] as TreeNode<T>[])

			);
		});

		if (treeNodes.length) {

			return combineLatest(treeNodes).pipe(

				map(nodes => [].concat(...nodes)),
	
			);

		} else {

			return of([]);
		}
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
