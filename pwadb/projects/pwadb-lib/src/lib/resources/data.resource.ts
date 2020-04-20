import { BehaviorSubject, Observable, Subscription, from, combineLatest, Subject } from 'rxjs';
import { Datatype, PwaDocument } from '../definitions/document';
import { HttpParams } from '@angular/common/http';
import { PwaListResponse } from '../definitions/collection';
import { switchMap, filter, map, finalize, tap, debounceTime } from 'rxjs/operators';


export interface DatasourceService<T extends Datatype> {

	subs: Subscription;

	fetchReactive: (params?: HttpParams) => Observable<PwaListResponse<T>>;

	fetch: (params?: HttpParams) => Observable<PwaListResponse<T>>;

	getTableLoadMoreDatabase?: (limit?: number) => TableLoadMoreDatabase<T>;

	getTreeLoadMoreDatabase?: (limit?: number) => TreeLoadMoreDatabase<T>;
}

export const LOAD_MORE = 'LOAD_MORE';

///////////////////////////
// Table
//////////////////////////

export class TableLoadMoreDatabase<T extends Datatype> {

	dataChange: BehaviorSubject<(PwaDocument<T> | string)[]>;
	isLoadingChange: BehaviorSubject<boolean>;

	private queueChange: Subject<HttpParams>;

	private _firstTime = false;
	private _httpParams: HttpParams;
	private _totalCount = 0;

	get totalCount() { return this._totalCount; }

	get data() { return this.dataChange.value; }
	set data(v: (PwaDocument<T> | string)[]) { this.dataChange.next(v); }

	get httpParams() { return this._httpParams; }
	set httpParams(v: HttpParams) {

		this._httpParams = v;

		this.reset();
	}

	get isLoading() { return this.isLoadingChange.value; }

	constructor(private apiService: DatasourceService<T>, private limit = 100) {

		this.dataChange = new BehaviorSubject([]);
		this.isLoadingChange = new BehaviorSubject(false);
		
		this._httpParams = new HttpParams();
		
		this.queueChange = new Subject();

		const subs = this.queueChange.pipe(

			tap(() => this.isLoadingChange.next(true)),

			switchMap(httpParams => this.apiService.fetch(httpParams)),

			debounceTime(500),
			
		).subscribe(res => {

			if (!this.isLoading) this.isLoadingChange.next(true);

			this._totalCount = res.count;

			const dictData: {[key: string]: PwaDocument<T> | string} = {};

			this.data.forEach(v => { if (typeof v === 'object') return dictData[v.tenantUrl] = v; });

			res.results.forEach(v => dictData[v.tenantUrl] = v);

			if (this.offset < this.totalCount) dictData[LOAD_MORE] = LOAD_MORE;

			this.data = Object.values(dictData);

			this.isLoadingChange.next(false);
		});

		this.apiService.subs.add(subs);
	}

	get offset() { return this.data.filter(v => v !== LOAD_MORE).length; }

	get isLoadable(): boolean { return this.offset < this.totalCount || (this.offset === this.totalCount && this._firstTime); }

	initialise() {

		this._firstTime = true;

		this.loadMore();

		this._firstTime = false;
	}

	reset() {

		this.data = [];

		this._firstTime = true;

		this.loadMore();

		this._firstTime = false;
	}

	loadMore() {

		if (!this.isLoadable || this.isLoading) return;

		this._httpParams = this.httpParams.set('offset', this.offset.toString());
		this._httpParams = this.httpParams.set('limit', this.limit.toString());

		this.queueChange.next(this.httpParams);
	}

}


///////////////////////////
// Tree
///////////////////////////

/** Flat node with expandable and level information */
export class LoadMoreFlatNode<T extends Datatype> {
    constructor(
        public doc: PwaDocument<T> | string,
        public level = 1,
		public expandable = false,
		public database: TreeLoadMoreDatabase<T>,
    ) {}
}

export type TreeMap<T extends Datatype> = Map<string | PwaDocument<T>, TreeLoadMoreDatabase<T> | TreeMap<any>[]>;

export interface DatabaseInformation<T extends Datatype> {
	apiService: DatasourceService<T>;
	onCreation: (parentDoc: PwaDocument<T>, db: TreeLoadMoreDatabase<T>, params: HttpParams) => void
}

export interface ChildTreeInformation<T extends Datatype> {
	[key: string]: DatabaseInformation<T>;
}

export class TreeLoadMoreDatabase<T extends Datatype> extends TableLoadMoreDatabase<T> {

	dataMapChange: BehaviorSubject<TreeMap<T>>;

    get dataMap() { return this.dataMapChange.value; }
	set dataMap(v: TreeMap<T>) { this.dataMapChange.next(v); }

    constructor(
      private _apiService: DatasourceService<T>,
      private childTreeInfo: ChildTreeInformation<any>,
      private _limit = 100
    ) {

		super(_apiService, _limit);

		this.dataMapChange = new BehaviorSubject(new Map());

		const subs = this.dataChange.pipe(

			switchMap(docs => from(docs)),

			filter(doc => typeof doc !== 'string' && !this.dataMap.has(doc)),

			switchMap((doc: PwaDocument<T>) => {

				// create databases for each document
				const childDatabases = Object.keys(this.childTreeInfo).map(k => {

					const db = this.childTreeInfo[k].apiService.getTreeLoadMoreDatabase();

					// extract http params
					const keys = this.httpParams.keys().filter(k => k.includes(`${k}_`));

					let childParams = new HttpParams();

					keys.forEach(k => childParams = childParams.set(k.split(`${k}_`)[1], this.httpParams.get(k)));

					// do on-creation for each childDatabase
					this.childTreeInfo[k].onCreation(doc, db, childParams);

					return db;
				});

				return combineLatest(childDatabases.map(v => v.dataMapChange)).pipe(

					map(maps => ({doc, maps}))

				);
			}),

		).subscribe(v => {

			this.dataMap.set(v.doc, v.maps)

			if (this.isLoadable) {

				this.dataMap.set(LOAD_MORE, this);

			} else {

				this.dataMap.delete(LOAD_MORE);
			}

			this.dataMap = this.dataMap;
		});

		this._apiService.subs.add(subs);

	}

	reset() {

		this.dataMap = new Map();

		super.reset();
	}

}
