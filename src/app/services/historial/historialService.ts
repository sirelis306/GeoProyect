import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class HistorialService {
  private http = inject(HttpClient);
  private API_URL = `${environment.apiUrl}/historial`;

  /* Obtiene el listado de historial de operaciones desde el backend con paginación y filtros. */
  obtenerHistorial(
    page: number = 1,
    limit: number = 10,
    accion?: string,
    tipo?: string,
    search?: string,
    fechaInicio?: string,
    fechaFin?: string
  ): Observable<any> {
    let url = `${this.API_URL}/listado?page=${page}&limit=${limit}`;
    if (accion && accion !== 'todos') {
      url += `&accion=${accion}`;
    }
    if (tipo && tipo !== 'todos') {
      url += `&tipo=${tipo}`;
    }
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    if (fechaInicio) {
      url += `&fecha_inicio=${fechaInicio}`;
    }
    if (fechaFin) {
      url += `&fecha_fin=${fechaFin}`;
    }
    return this.http.get<any>(url);
  }
}
