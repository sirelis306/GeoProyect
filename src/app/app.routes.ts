import { Routes } from '@angular/router';
import { Login } from './components/login/login';
import { Map } from './components/map/map';
import { authGuard } from './guards/auth-guard';
import { Users } from './components/users/users';
import { AddUser } from './components/add-user/add-user';

export const routes: Routes = [
    { path: 'login', component: Login },
    { path: 'mapa', component: Map, canActivate: [authGuard] },
    { path: 'usuarios', component: Users, canActivate: [authGuard] },
    { path: 'usuarios/nuevo', component: AddUser, canActivate: [authGuard] },
    { path: 'usuarios/editar/:id', component: AddUser, canActivate: [authGuard] },
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    { path: '**', redirectTo: 'login' },
];
