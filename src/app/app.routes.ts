import { Routes } from '@angular/router';
import { Login } from './components/login/login'; 
import { Map } from './components/map/map';
import { authGuard } from './guards/auth-guard';
import { Users } from './components/users/users';

export const routes: Routes = [
    { path: 'login', component: Login },
    { path: 'mapa', component: Map, canActivate: [authGuard] },
    { path: 'usuarios', component: Users, canActivate: [authGuard] }, // Agrega el guard aquí también
    { path: '', redirectTo: 'mapa', pathMatch: 'full' }, // Redirigir al mapa, no al login si ya estás logueado
    { path: '**', redirectTo: 'login' },
];
