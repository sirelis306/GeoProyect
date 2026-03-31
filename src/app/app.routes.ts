import { Routes } from '@angular/router';
import { Login } from './components/login/login'; 
import { Map } from './components/map/map';
import { authGuard } from './guards/auth-guard';

export const routes: Routes = [
    { path: 'login', component: Login },
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    { path: '**', redirectTo: 'login' },
    { path: 'mapa', component: Map, canActivate: [authGuard] },
];
