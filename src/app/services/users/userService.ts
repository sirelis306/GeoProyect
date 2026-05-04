import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private API_URL = 'http://localhost:3000/api/users';
  // private API_URL = 'https://geobackend-api.onrender.com/api/users';

  /* Obtiene la lista completa de usuarios desde el backend. */
  obtenerUsuarios(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/listado`);
  }

  /* Obtiene todos los roles definidos en la base de datos. */
  obtenerRoles(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/roles`);
  }

  /* Desactiva un usuario por su ID. */
  desactivarUsuario(id: number): Observable<any> {
    return this.http.put(`${this.API_URL}/desactivar/${id}`, {});
  }

  /* Obtiene un usuario específico por su ID. */
  obtenerUsuarioPorId(id: number): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/obtener/${id}`);
  }

  /* Crea un nuevo usuario. */
  crearUsuario(user: any): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/crear`, user);
  }

  /* Actualiza los datos de un usuario existente. */
  actualizarUsuario(id: number, user: any): Observable<any> {
    return this.http.put<any>(`${this.API_URL}/actualizar/${id}`, user);
  }
}
