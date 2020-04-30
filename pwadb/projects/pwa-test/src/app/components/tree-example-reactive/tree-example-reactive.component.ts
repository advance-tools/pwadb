import { Component, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CountriesApiService, Country, City, State } from 'pwadb-api-lib';
import { FlatTreeControl } from '@angular/cdk/tree';
import { DynamicFlatNode, TreeNode, TreeDatabase, PwaDocument} from 'pwadb-lib';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { Subscription } from 'rxjs';

type NestedDocuments = Country | State | City;

@Component({
    selector: 'app-tree-example-reactive',
    templateUrl: './tree-example-reactive.component.html',
    styleUrls: ['./tree-example-reactive.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TreeExampleReactiveComponent implements OnDestroy {

    treeControl: FlatTreeControl<DynamicFlatNode<NestedDocuments>>;
    treeFlattener: MatTreeFlattener<TreeNode<NestedDocuments>, DynamicFlatNode<NestedDocuments>>;
    dataSource: MatTreeFlatDataSource<TreeNode<NestedDocuments>, DynamicFlatNode<NestedDocuments>>;
    database: TreeDatabase<NestedDocuments>;

    flatNodeMap: Map<string, DynamicFlatNode<NestedDocuments>>;

    transformer = (node: TreeNode<NestedDocuments>, level: number) => {
        
        const existingNode = this.flatNodeMap.get(node.item.tenantUrl);

        if (existingNode?.item !== node.item || existingNode?.expandable !== node.children.length > 0) {

            const flatNode = new DynamicFlatNode(node.item, level, node.children.length > 0);

            this.flatNodeMap.set(node.item.tenantUrl, flatNode);

            return flatNode;
        }

        return existingNode;
    }

    subs: Subscription;

    hasChild = (_: number, node: DynamicFlatNode<NestedDocuments>) => node.expandable;

    constructor(private c: CountriesApiService) {

        this.flatNodeMap = new Map();

        this.treeControl    = new FlatTreeControl<DynamicFlatNode<NestedDocuments>>(node => node.level, node => node.expandable);
        this.treeFlattener  = new MatTreeFlattener<TreeNode<Country>, DynamicFlatNode<NestedDocuments>>(this.transformer, node => node.level, node => node.expandable, node => node.children);
        this.dataSource     = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);

        this.subs = new Subscription();

        this.database = this.c.getTreeReactiveDatabase(5);

        this.database.httpParams = this.database.httpParams.set('countries--states--order_by', '-name').set('countries--states--cities--order_by', '-name')

        const subs = this.database.dataChange.subscribe(v => this.dataSource.data = v);

        this.subs.add(subs);
    }

    ngOnDestroy() {

        this.subs.unsubscribe();
    }

    isLoadable(item: PwaDocument<NestedDocuments>) {

        const db = this.database.databaseMap.get(item);

        return db?.isLoadable && db?.data.indexOf(item) === db.data.length - 1;
    }

    isLoading(item: PwaDocument<NestedDocuments>) {

        const db = this.database.databaseMap.get(item);

        return db?.isLoadable && db?.data.indexOf(item) === db.data.length - 1 && db?.isLoading;
    }

    loadMore(item: PwaDocument<NestedDocuments>) {

        const db = this.database.databaseMap.get(item);

        db.loadMore();
    }
}
