import { HttpParams } from '@angular/common/http';
import { BehaviorSubject, combineLatest, concat, merge, Observable, of } from 'rxjs';
import { concatMap, filter, map, mergeMap, shareReplay, switchMap, tap } from 'rxjs/operators';
import { PwaDocument } from '../definitions/document';
import { Database, ReactiveDatabase, TableDataType } from './table.resource';
import {CollectionViewer, SelectionChange, DataSource} from '@angular/cdk/collections';
import {FlatTreeControl} from '@angular/cdk/tree';

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

    childTreeMap: Map<PwaDocument<any>, TreeNode<any>>;
    databaseMap: Map<PwaDocument<any>, Database<any> | ReactiveDatabase<any>>;

    databaseKeyMap: Map<string, Database<any> | ReactiveDatabase<any>>;

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

        this.databaseMap    = new Map();
        this.databaseKeyMap = new Map();
        this.childTreeMap   = new Map();

        this._httpParams  = new HttpParams();
        this.queueChange  = new BehaviorSubject(true);

        this.dataChange = this.queueChange.asObservable().pipe(

            switchMap(() => this.buildTree(this.treeInfo, null, this.httpParams)),

            shareReplay(1),

        );
    }

    buildTree(treeInfo: TreeInformation<T>, parentDoc: PwaDocument<T> = null, parentParams = new HttpParams(), parentKey = null): Observable<TreeNode<T>[]> {

        const treeNodes = Object.keys(treeInfo).map(key => {

            const db = treeInfo[key].getDatabase();

            const currentDatabaseMapKey = parentKey && parentDoc ? `${parentKey}~${parentDoc.tenantUrl}--${key}` : key;

            this.databaseKeyMap.set(currentDatabaseMapKey, db);

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

                    currentParams = currentParams.set(paramName, parentParams.get(pk));
                }

            });

            // run callback
            treeInfo[key].onCreationSetup ? treeInfo[key].onCreationSetup(parentDoc, db, currentParams) : db.httpParams = currentParams;

            return db.dataChange.pipe(

                map(docs => {

                    const obsArr = docs.map(doc => {

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

                            const childTree = this.buildTree(treeInfo[key].children, doc, parentParams, currentDatabaseMapKey).pipe(

                                shareReplay(1),

                            ) as Observable<TreeNode<any>[]>;

                            this.childTreeMap.set(doc, {item: doc, children: childTree});
                        }

                        return this.childTreeMap.get(doc);

                    });

                    return obsArr;
                }),

            );
        });

        return combineLatest(treeNodes).pipe(

            map(nodes => [].concat(...nodes)),

        );
    }

    reset() {

        this.databaseMap.clear();
        this.databaseKeyMap.clear();
        this.childTreeMap.clear();

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

export class DynamicTreeFlattener<T, F> {

    flatNodeMap = new Map<T, F>();
    structuredNodeMap = new Map<F, T>();
    parentNodeMap = new Map<F, F>();

    constructor(public transformFunction: (node: T, level: number) => F,
                public getLevel: (node: F) => number,
                public isExpandable: (node: F) => boolean,
                public getChildren: (node: T) =>
                    Observable<T[]> | T[] | undefined | null) {}

    _flattenNode(node: T, level: number): F {

        if (!this.flatNodeMap.has(node)) {

            const flatNode = this.transformFunction(node, level);

            this.flatNodeMap.set(node, flatNode);
            this.structuredNodeMap.set(flatNode, node);
        }

        return this.flatNodeMap.get(node);
    }

    insertChildrenFlatNodes(parentNode: F, children: F[], resultNodes: F[]): F[] {

        const index = resultNodes.indexOf(parentNode);

        resultNodes.splice(index + 1, 0, ...children);

        children.filter(c => !this.parentNodeMap.has(c)).forEach(c => this.parentNodeMap.set(c, parentNode));

        return resultNodes;
    }

    removeChildrenFlatNodes(parentNode: F, resultNodes: F[]): F[] {

        const index = resultNodes.indexOf(parentNode);

        let count = 0;

        for (let i = index + 1; i < resultNodes.length && this.getLevel(resultNodes[i]) > this.getLevel(parentNode); i++, count++) {}

        const children = resultNodes.splice(index + 1, count);

        children.filter(c => this.parentNodeMap.has(c)).forEach(c => this.parentNodeMap.delete(c));

        return resultNodes;
    }

    addChildrenFlatNode(parentFlatNode: F, resultNodes: F[]): Observable<F[]> {

        // fetch structuredNode corresponding to this parentFlatNode
        const structuredNode = this.structuredNodeMap.get(parentFlatNode);

        // fetch structuredChildrenNode corresponding to this structuredNode
        const structuredChildrenNodes = this.getChildren(structuredNode);

        if (structuredChildrenNodes) {

            if (Array.isArray(structuredChildrenNodes)) {

                const flatChildren = structuredChildrenNodes.map(s => this._flattenNode(s, this.getLevel(parentFlatNode) + 1));

                return of(this.insertChildrenFlatNodes(parentFlatNode, flatChildren, resultNodes));

            } else {

                return structuredChildrenNodes.pipe(

                    map(children => children.map(s => this._flattenNode(s, this.getLevel(parentFlatNode) + 1))),

                    map(flatChildren => {

                        resultNodes = this.removeChildrenFlatNodes(parentFlatNode, resultNodes);

                        return this.insertChildrenFlatNodes(parentFlatNode, flatChildren, resultNodes);
                    }),
                );

            }
        }

        return of(resultNodes);
    }

    /**
     * Flatten a list of node type T to flattened version of node F.
     * Please note that type T may be nested, and the length of `structuredData` may be different
     * from that of returned list `F[]`.
     */
    flattenNodes(structuredData: T[]): F[] {

        return structuredData.map(node => this._flattenNode(node, 0));
    }

}

export class DynamicFlatTreeDataSource<T, F> implements DataSource<F> {

    readonly _flattenedData = new BehaviorSubject<F[]>([]);
    private readonly _data = new BehaviorSubject<T[]>([]);

    get data() { return this._data.value; }

    set data(value: T[]) {

        this._data.next(value);

        const flattenedData = this._treeFlattener.flattenNodes(this.data);

        this._treeControl.expansionModel.clear();

        this._treeControl.dataNodes = flattenedData;

        this.flattenedData = flattenedData;
    }

    mergeData(value: T[]) {

        this._data.next(value);

        const flattenedData = this._treeFlattener.flattenNodes(this.data);

        const mergedFlattenedSet = new Set(this.flattenedData.concat(flattenedData));

        const appendFlattenedData = Array.from(mergedFlattenedSet.values());

        this._treeControl.dataNodes = appendFlattenedData;

        this.flattenedData = appendFlattenedData;
    }

    get flattenedData(): F[] { return this._flattenedData.value; }
    set flattenedData(v: F[]) { this._flattenedData.next(v); }

    constructor(public _treeControl: FlatTreeControl<F>, public _treeFlattener: DynamicTreeFlattener<T, F>, initialData?: T[]) {

        if (initialData) {
            // Assign the data through the constructor to ensure that all of the logic is executed.
            this.data = initialData;
        }
    }

    /**
     * Toggle the node, remove from display list
     */
    toggleNode(flatNode: F, expand: boolean): Observable<F[]> {

        if (expand) {

            if (this._treeFlattener.isExpandable(flatNode)) {

                return this._treeFlattener.addChildrenFlatNode(flatNode, this.flattenedData);
            }

            return this._flattenedData.asObservable();

        } else {

            return of(this._treeFlattener.removeChildrenFlatNodes(flatNode, this.flattenedData));
        }
    }

    /** Handle expand/collapse behaviors */
    handleTreeControl(change: SelectionChange<F>): Observable<F[]> {

        if (change.added) {

            const obsArray = change.added.map(node => this.toggleNode(node, true));

            return combineLatest(obsArray).pipe(map((o) => o[obsArray.length - 1]));
        }

        if (change.removed) {

            const obsArray = change.removed.slice().reverse().map(node => this.toggleNode(node, false));

            return combineLatest(obsArray).pipe(map((o) => o[obsArray.length - 1]));
        }

    }

    connect(collectionViewer: CollectionViewer): Observable<F[]> {

        const changeObs = this._treeControl.expansionModel.changed.pipe(

            filter(change => !!(change as SelectionChange<F>).added?.length || !!(change as SelectionChange<F>).removed?.length),

            mergeMap(change => this.handleTreeControl(change as SelectionChange<F>)),

            tap(v => this._treeControl.dataNodes = v),

            tap(v => this.flattenedData = v),

        );

        return merge(collectionViewer.viewChange, changeObs, this._flattenedData.asObservable()).pipe(map(() => this.flattenedData));
    }

    disconnect(collectionViewer: CollectionViewer): void {}
}
