import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { TenantComponent } from './components/tenant/tenant.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { CountryListComponent } from './components/countries/list/country-list.component';
import { CountryDetailComponent } from './components/countries/detail/country-detail.component';
import { TreeExampleComponent } from './components/tree-example/tree-example.component';

const routes: Routes = [
    {
        path: '',
        component: TenantComponent
    },
    {
        path: 'dashboard',
        component: DashboardComponent
    },
    {
        path: 'countries',
        component: CountryListComponent
    },
    {
        path: 'countries/:id',
        component: CountryDetailComponent
    },
    {
        path: 'tree-example',
        component: TreeExampleComponent
    },
]

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
  })
  export class AppRoutingModule { }