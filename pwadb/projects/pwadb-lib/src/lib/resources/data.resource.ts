import { BehaviorSubject, Observable, Subscription, combineLatest, Subject } from 'rxjs';
import { PwaDocument } from '../definitions/document';
import { HttpParams } from '@angular/common/http';
import { PwaListResponse } from '../definitions/collection';
import { switchMap, tap, filter, debounceTime, shareReplay, map, startWith} from 'rxjs/operators';

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

		if (!this._firstTime) this.reset();
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

	constructor(private apiService: DatabaseService<T>, private _limit = 20) {

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

	constructor(private apiService: DatabaseService<T>, private _limit = 20) {

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

export type TreeNode<T extends DatabaseDatatype> = {item: PwaDocument<T>, children: TreeNode<any>[]};

export interface DatabaseInformation<T extends DatabaseDatatype> {
	getDatabase: (limit?: number) => Database<T> | ReactiveDatabase<T>;
	onCreationSetup?: (parentDoc: PwaDocument<T>, db: Database<T> | ReactiveDatabase<T>, params: HttpParams) => void;
	children: TreeInformation<T>;
}

export interface TreeInformation<T extends DatabaseDatatype> {
	[key: string]: DatabaseInformation<T>;
}

export class TreeDatabase<T extends DatabaseDatatype> {

	dataChange: BehaviorSubject<TreeNode<T>[]>;
	databaseMap: Map<PwaDocument<T>, Database<T> | ReactiveDatabase<T>>;

	subs: Subscription;

	private _firstTime = true;
	private childTreeMap: Map<PwaDocument<T>, Observable<TreeNode<T>>>;
	private _httpParams: HttpParams;

    get data() { return this.dataChange.value; }
	set data(v: TreeNode<T>[]) { this.dataChange.next(v); }

	get httpParams() { return this._httpParams; }
	set httpParams(v: HttpParams) {

		this._httpParams = v;

		if (!this._firstTime) this.reset();
	}

    constructor(private treeInfo: TreeInformation<T>, private limit = 20) {

		this.databaseMap  = new Map();
		this.childTreeMap = new Map();
		this._httpParams  = new HttpParams();
		this.dataChange   = new BehaviorSubject([]);

		this.subs = new Subscription();
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
			if (parentDoc && treeInfo[key].onCreationSetup) treeInfo[key].onCreationSetup(parentDoc, db, childParams);

			if (!treeInfo[key].onCreationSetup) db.httpParams = childParams;

			// initialise db
			db.initialise();

			return db.dataChange.pipe(

				switchMap(docs => {
					
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
							);

							this.childTreeMap.set(doc, childTree);
						}

						return this.childTreeMap.get(doc);

					});

					return combineLatest(obs);
				}),
			);
		});

		return combineLatest(treeNodes).pipe(

			map(nodes => nodes.reduce((acc, cur) => acc.concat(cur), [])),

			startWith([]),
		)
	}

	initialise() {

		this._firstTime = true;

		const subs = this.buildTree(this.treeInfo, null, this.httpParams).subscribe(v => this.data = v);

		this.subs.add(subs);

		this._firstTime = false;
	}

	reset() {

		this.stop();

		this.databaseMap  = new Map();
		this.childTreeMap = new Map();

		this.initialise();
	}

	stop() {

		this.databaseMap.forEach(v => v.stop());

		this.subs.unsubscribe();
	}

}


// export class TreeReactiveDatabase<T extends DatabaseDatatype> extends ReactiveDatabase<T> {

// 	dataMapChange: BehaviorSubject<TreeNode<T>[]>;
// 	databaseMap: Map<PwaDocument<any>, TreeReactiveDatabase<any>>
// 	childDatabaseMap: Map<PwaDocument<any>, TreeReactiveDatabase<any>[]>;

//     get dataMap() { return this.dataMapChange.value; }
// 	set dataMap(v: TreeNode<T>[]) { this.dataMapChange.next(v); }

//     constructor(
// 		private __apiService: DatabaseService<T>,
// 		private childTreeInfo: ChildTreeInformation<any>,
// 		private __limit = 100
//     ) {

// 		super(__apiService, __limit);

// 		this.databaseMap 		= new Map();
// 		this.childDatabaseMap 	= new Map();
// 		this.dataMapChange 		= new BehaviorSubject([]);

// 		const subs = this.dataChange.pipe(

// 			switchMap(docs => {

// 				const obs = docs.map(doc => {

// 					///////////////////
// 					// Database Map
// 					///////////////////
// 					if (!this.databaseMap.has(doc)) this.databaseMap.set(doc, this);

// 					/////////////////////
// 					// ChildDatabase Map
// 					/////////////////////

// 					const exisitingDatabase = this.childDatabaseMap.get(doc);

// 					let curTreeDatabases: TreeReactiveDatabase<any>[];

// 					if (!exisitingDatabase) {

// 						// create databases for each document
// 						curTreeDatabases = Object.keys(this.childTreeInfo).map(k => {
		
// 							const db = this.childTreeInfo[k].apiService.getTreeReactiveDatabase(this.__limit);
	
// 							// extract http params
// 							const keys = this.httpParams.keys().filter(pk => pk.includes(`${k}_`));
	
// 							let childParams = new HttpParams();
	
// 							keys.forEach(pk => childParams = childParams.set(pk.split(`${pk}_`)[1], this.httpParams.getAll(pk).join(',')));
	
// 							// do on-creation for each childDatabase
// 							this.childTreeInfo[k].onCreation(doc, db, childParams);
	
// 							db.initialise();
	
// 							return db;
// 						});

// 						this.childDatabaseMap.set(doc, curTreeDatabases);

// 					} else {

// 						curTreeDatabases = exisitingDatabase;
// 					}

// 					if (curTreeDatabases.length === 0) return of({item: doc, children: []});

// 					return combineLatest(curTreeDatabases.map(v => v.dataMapChange)).pipe(

// 						tap(() => curTreeDatabases.forEach(v => [...v.databaseMap.entries()].forEach(([ndoc, ndb]) => { if (!this.databaseMap.has(ndoc)) this.databaseMap.set(ndoc, ndb); }))),

// 						tap(() => curTreeDatabases.forEach(v => [...v.childDatabaseMap.entries()].forEach(([ndoc, ndb]) => { if (!this.childDatabaseMap.has(ndoc)) this.childDatabaseMap.set(ndoc, ndb); }) )),

// 						map(children => children.reduce((acc, cur) => acc.concat(cur), [])),

// 						map(children => ({item: doc, children})),

// 					);
// 				});

// 				return combineLatest(obs);
// 			}),


// 		).subscribe((v: TreeNode<T>[]) => this.dataMap = v);

// 		this.subs.add(subs);
// 	}

// 	reset() {

// 		this.childDatabaseMap.forEach(v => v.forEach(d => d.stop()));

// 		this.databaseMap 		= new Map();
// 		this.childDatabaseMap 	= new Map();

// 		super.reset();
// 	}

// 	stop() {

// 		this.childDatabaseMap.forEach(v => v.forEach(d => d.stop()));

// 		this.databaseMap 		= new Map();
// 		this.childDatabaseMap 	= new Map();

// 		super.stop();
// 	}

// }

/////////////////////
// DataSource
/////////////////////

export const LOAD_MORE = 'LOAD_MORE';

/** Flat node with expandable and level information */
export class DynamicFlatNode<T extends DatabaseDatatype> {
    constructor(
        public item: PwaDocument<T> | string,
        public level = 1,
		public expandable = false,
    ) {}
}
