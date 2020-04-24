import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { TenantComponent } from './components/tenant/tenant.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { CountryListComponent } from './components/countries/list/country-list.component';
import { CountryDetailComponent } from './components/countries/detail/country-detail.component';
import { TreeExampleComponent } from './components/tree-example/tree-example.component';
import { CanActivateRouteGuard } from './guards/profile.guard';

const routes: Routes = [
    {
        path: '',
        component: TenantComponent
    },
    {
        path: 'dashboard',
        component: DashboardComponent,
        canActivate: [CanActivateRouteGuard]
    },
    {
        path: 'countries',
        component: CountryListComponent,
        canActivate: [CanActivateRouteGuard]
    },
    {
        path: 'countries/:id',
        component: CountryDetailComponent,
        canActivate: [CanActivateRouteGuard]
    },
    {
        path: 'tree-example',
        component: TreeExampleComponent,
        canActivate: [CanActivateRouteGuard]
    },
    {
        path: '**',
        redirectTo: '',
    }
]

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
  })
  export class AppRoutingModule { }