import { HttpParams } from '@angular/common/http';
import { BehaviorSubject, combineLatest, merge, Observable, Subscription } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
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

                    currentParams = currentParams.set(paramName, parentParams.get(pk));
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

export class DynamicTreeFlattener<T, F> {

    flatNodeMap = new Map<T, F>();
    structuredNodeMap = new Map<F, T>();

    subs = new Subscription();

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

    insertChildrenNodes(parentNode: F, children: F[], resultNodes: F[]): F[] {

        const index = resultNodes.indexOf(parentNode);

        resultNodes.splice(index + 1, 0, ...children);

        return resultNodes;
    }

    removeChildrenFlatNodes(parentNode: F, resultNodes: F[]): F[] {

        const index = resultNodes.indexOf(parentNode);

        let count = 0;

        for (let i = index + 1; i < resultNodes.length && this.getLevel(resultNodes[i]) > this.getLevel(parentNode); i++, count++) {}

        resultNodes.splice(index + 1, count);

        return resultNodes;
    }

    addChildrenFlatNode(parentFlatNode: F, resultNodes: F[]): F[] {

        // fetch structuredNode corresponding to this parentFlatNode
        const structuredNode = this.structuredNodeMap.get(parentFlatNode);

        // fetch structuredChildrenNode corresponding to this structuredNode
        const structuredChildrenNodes = this.getChildren(structuredNode);

        if (structuredChildrenNodes) {

            if (Array.isArray(structuredChildrenNodes)) {

                const flatChildren = structuredChildrenNodes.map(s => this._flattenNode(s, this.getLevel(parentFlatNode) + 1));

                this.insertChildrenNodes(parentFlatNode, flatChildren, resultNodes);

            } else {

                const subs = structuredChildrenNodes.subscribe(children => {

                    const flatChildren = children.map(s => this._flattenNode(s, this.getLevel(parentFlatNode) + 1));

                    // remove previously inserted children
                    this.removeChildrenFlatNodes(parentFlatNode, resultNodes);

                    // add new children
                    this.insertChildrenNodes(parentFlatNode, flatChildren, resultNodes);
                });

                this.subs.add(subs);
            }
        }

        return resultNodes;
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

    private readonly _flattenedData = new BehaviorSubject<F[]>([]);
    private readonly _data = new BehaviorSubject<T[]>([]);

    subs = new Subscription();

    get data() { return this._data.value; }

    set data(value: T[]) {

        this._data.next(value);

        this.flattenedData = this._treeFlattener.flattenNodes(this.data);
    }

    get flattenedData(): F[] { return this._flattenedData.value; }
    set flattenedData(v: F[]) { this._flattenedData.next(v); }

    constructor(private _treeControl: FlatTreeControl<F>,
                private _treeFlattener: DynamicTreeFlattener<T, F>,
                initialData?: T[]) {

        const subs = this._flattenedData.subscribe(v => this._treeControl.dataNodes = v);

        this.subs.add(subs);

        if (initialData) {
            // Assign the data through the constructor to ensure that all of the logic is executed.
            this.data = initialData;
        }
    }

    /**
     * Toggle the node, remove from display list
     */
    toggleNode(flatNode: F, expand: boolean): void {

        if (expand) {

            if (this._treeFlattener.isExpandable(flatNode)) {

                this.flattenedData = this._treeFlattener.addChildrenFlatNode(flatNode, this.flattenedData);
            }

        } else {

            this.flattenedData = this._treeFlattener.removeChildrenFlatNodes(flatNode, this.flattenedData);
        }
    }

    /** Handle expand/collapse behaviors */
    handleTreeControl(change: SelectionChange<F>) {

        if (change.added) {

            change.added.forEach(node => this.toggleNode(node, true));
        }

        if (change.removed) {

            change.removed.slice().reverse().forEach(node => this.toggleNode(node, false));
        }
    }

    connect(collectionViewer: CollectionViewer): Observable<F[]> {

        const subs = this._treeControl.expansionModel.changed.subscribe(change => {

            if ((change as SelectionChange<F>).added || (change as SelectionChange<F>).removed) {

                this.handleTreeControl(change as SelectionChange<F>);
            }

        });

        this.subs.add(subs);

        return merge(collectionViewer.viewChange, this._flattenedData.asObservable()).pipe(map(() => this.flattenedData));
    }

    disconnect(collectionViewer: CollectionViewer): void {

        this._treeFlattener.subs.unsubscribe();

        this.subs.unsubscribe();
    }
}
