import { Routes } from '@angular/router';
import { Login } from './components/login/login'; 
import { Map } from './components/map/map';
import { authGuard } from './guards/auth-guard';
import { Users } from './components/users/users';

export const routes: Routes = [
    { path: 'login', component: Login },
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    { path: '**', redirectTo: 'login' },
    { path: 'mapa', component: Map, canActivate: [authGuard] },
    { path: 'usuarios', component: Users },
];
