import { HttpParams } from '@angular/common/http';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import { PwaDocument } from '../definitions/document';
import { Database, ReactiveDatabase, TableDataType } from './table.resource';

///////////////////
// Interfaces
///////////////////

export type TreeNode<T extends TableDataType> = {item: PwaDocument<T>, children: Observable<TreeNode<any>[]>};

export interface DatabaseInformation<T extends TableDataType> {
    getDatabase: (limit?: number) => Database<T> | ReactiveDatabase<T>;
    onCreationSetup?: (parentDoc: PwaDocument<T> | null, db: Database<T> | ReactiveDatabase<T>, params: HttpParams) => void;
    isRecursive: boolean;
    children: TreeInformation<T>;
}

export interface TreeInformation<T extends TableDataType> {
    [key: string]: DatabaseInformation<T>;
}


///////////////////
// Trees
///////////////////


export class TreeDatabase<T extends TableDataType> {

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

    buildTree(treeInfo: TreeInformation<T>, parentDoc: PwaDocument<T> = null, parentParams = new HttpParams()): Observable<TreeNode<T>[]> {

        const treeNodes = Object.keys(treeInfo).map(key => {

            const db = treeInfo[key].getDatabase();

            // check current httpParams
            const possibleParamKeys = parentParams.keys().filter(pk => pk && pk.includes(`${key}--`));

            // create new params associated to this database
            let currentParams = new HttpParams();

            // extract childParams
            possibleParamKeys.forEach(pk => {

                const paramName = pk.split(`${key}--`)[1];

                // only set param associated to this database
                // extra '--' would mean params to nested database
                if (!paramName.includes('--')) {

                    currentParams = currentParams.set(paramName, currentParams.getAll(pk).join(','));
                }

            });

            // run callback
            treeInfo[key].onCreationSetup ? treeInfo[key].onCreationSetup(parentDoc, db, currentParams) : db.httpParams = currentParams;

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

                            // add the current treeInfo in children
                            // if isRecursive == true
                            if (treeInfo[key].isRecursive) {

                                treeInfo[key].children[key] = treeInfo[key];

                            }

                            const childTree = this.buildTree(treeInfo[key].children, doc, parentParams).pipe(

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
export class DynamicFlatNode<T extends TableDataType> {
    constructor(
        public item: PwaDocument<T> | string,
        public level = 1,
        public expandable = false,
    ) {}
}
