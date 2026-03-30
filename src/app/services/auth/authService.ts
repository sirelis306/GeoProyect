import { Injectable, inject } from '@angular/core';
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

  login(creds: any) {
    return this.http.post<any>(`${this.URL_API}/login`, creds).pipe(
      tap(res => {
        // Guardamos el token en el "bolsillo" del navegador
        localStorage.setItem('token_geo', res.token);
      })
    );
  }

  // Función para saber si el usuario está logueado
  estaLogueado(): boolean {
    return !!localStorage.getItem('token_geo');
  }

  logout() {
    localStorage.removeItem('token_geo');
    this.router.navigate(['/login']);
  }
}

