import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private URL_API = `${environment.apiUrl}/auth`;

  private getStoredUser() {
    const data = localStorage.getItem('user_geo');
    if (!data || data === 'undefined') return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  private decodeToken(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payloadDecoded = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(payloadDecoded);
    } catch (e) {
      return null;
    }
  }

  currentUser = signal<any>(this.getStoredUser());

  login(creds: any) {
    // Llamada real al backend para obtener token y datos de usuario
    return this.http.post<any>(`${this.URL_API}/login`, creds).pipe(
      tap(res => {
        if (res && res.token) {
          localStorage.setItem('token_geo', res.token);
          let user = res.user;
          if (!user) {
            const payload = this.decodeToken(res.token);
            if (payload) {
              const rolesList = payload.roles || [];
              const isSuper = rolesList.includes('ROLE_SUPER_ADMINISTRADOR') || rolesList.includes('ROLE_SUPER_ADMIN') || rolesList.includes('super_administrador');
              const isAdmin = rolesList.includes('ROLE_ADMINISTRADOR') || rolesList.includes('ROLE_ADMIN') || rolesList.includes('administrador');
              const isAnalyst = rolesList.includes('ROLE_ANALISTA') || rolesList.includes('ROLE_ANALYST') || rolesList.includes('analista');
              const isRegular = rolesList.includes('ROLE_REGULAR') || rolesList.includes('ROLE_USER') || rolesList.includes('regular');

              user = {
                id: payload.user_id,
                email: payload.username || payload.email,
                primer_nombre: payload.primer_nombre,
                primer_apellido: payload.primer_apellido,
                roles: {
                  rol_super_administrador: isSuper,
                  rol_administrador: isAdmin,
                  rol_analista: isAnalyst,
                  rol_regular: isRegular || (!isSuper && !isAdmin && !isAnalyst)
                },
                cambiar_password: payload.cambiar_password === true || payload.cambiar_password === 1
              };
            }
          } else {
            user.cambiar_password = res.user.cambiar_password === true || res.user.cambiar_password === 1;
          }
          localStorage.setItem('user_geo', JSON.stringify(user));
          this.currentUser.set(user);
        }
      })
    );
  }

  cambiarPassword(payload: any) {
    return this.http.post<any>(`${environment.apiUrl}/users/change-password`, payload).pipe(
      tap(res => {
        const user = this.getStoredUser();
        if (user) {
          user.cambiar_password = false;
          localStorage.setItem('user_geo', JSON.stringify(user));
          this.currentUser.set(user);
        }
      })
    );
  }

  getUserRol(): string {
    const user = this.getStoredUser();
    if (user && user.roles) {
      if (user.roles.rol_super_administrador) return 'super_admin';
      if (user.roles.rol_administrador) return 'admin';
      if (user.roles.rol_analista) return 'analista';
      if (user.roles.rol_regular) return 'regular';
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
