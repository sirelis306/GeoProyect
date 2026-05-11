import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private URL_API = 'http://localhost:3000/api/auth';
  // private URL_API = 'https://geobackend-api.onrender.com/api/auth';


  currentUser = signal<any>(JSON.parse(localStorage.getItem('user_geo') || 'null'));

  login(creds: any) {
    // Llamada real al backend para obtener token y datos de usuario
    return this.http.post<any>(`${this.URL_API}/login`, creds).pipe(
      tap(res => {
        if (res && res.token) {
          localStorage.setItem('token_geo', res.token);
          localStorage.setItem('user_geo', JSON.stringify(res.user));
          this.currentUser.set(res.user);
        }
      })
    );
  }

  getUserRol(): string {
    const userJson = localStorage.getItem('user_geo');
    if (userJson) {
      const user = JSON.parse(userJson);
      if (user.roles) {
        if (user.roles.rol_super_administrador) return 'super_admin';
        if (user.roles.rol_administrador) return 'admin';
        if (user.roles.rol_analista) return 'analista';
        if (user.roles.rol_regular) return 'regular';
      }
    }
    return 'invitado';
  }

  // Función para saber si el usuario está logueado
  estaLogueado(): boolean {
    return !!localStorage.getItem('token_geo');
  }

  logout() {
    localStorage.removeItem('token_geo');
    localStorage.removeItem('user_geo');
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }
}
