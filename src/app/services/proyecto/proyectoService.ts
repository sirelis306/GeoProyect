import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Proyecto, ProyectoFigura } from '../../models/gis';

@Injectable({
  providedIn: 'root'
})
export class ProyectoService {
  private http = inject(HttpClient);
  private URL_API = `${environment.apiUrl}/project`;

  // Signals para gestionar el estado actual de los proyectos en el frontend
  proyectos = signal<Proyecto[]>([]);
  proyectoActivo = signal<Proyecto | null>(null);
  figurasProyectoActivo = signal<ProyectoFigura[]>([]);

  cargarProyectos() {
    this.http.get<Proyecto[]>(this.URL_API).subscribe({
      next: (data: Proyecto[]) => this.proyectos.set(data),
      error: (err: any) => console.error('Error cargando proyectos:', err)
    });
  }

  crearProyecto(nombre: string, descripcion?: string): Observable<any> {
    return this.http.post<any>(this.URL_API, { nombre, descripcion });
  }

  eliminarProyecto(id: number): Observable<any> {
    return this.http.delete<any>(`${this.URL_API}/${id}`);
  }

  cargarFigurasProyecto(proyectoId: number) {
    this.http.get<ProyectoFigura[]>(`${this.URL_API}/${proyectoId}/figuras`).subscribe({
      next: (data: ProyectoFigura[]) => {
        // Por defecto, todas las figuras se cargan visibles en el mapa (👁️)
        const conVisible = data.map((f: ProyectoFigura) => ({ ...f, visible: f.visible !== false }));
        this.figurasProyectoActivo.set(conVisible);
      },
      error: (err: any) => console.error(`Error cargando figuras del proyecto ${proyectoId}:`, err)
    });
  }

  guardarFigura(proyectoId: number, figura: Omit<ProyectoFigura, 'proyecto_id'>): Observable<any> {
    return this.http.post<any>(`${this.URL_API}/${proyectoId}/figuras`, figura);
  }

  eliminarFigura(figuraId: number): Observable<any> {
    return this.http.delete<any>(`${this.URL_API}/figuras/${figuraId}`);
  }

  seleccionarProyecto(proyecto: Proyecto | null) {
    this.proyectoActivo.set(proyecto);
    if (proyecto && proyecto.id) {
      this.cargarFigurasProyecto(proyecto.id);
    } else {
      this.figurasProyectoActivo.set([]);
    }
  }

  toggleVisibilidadFigura(figuraId: number) {
    this.figurasProyectoActivo.update((figuras: ProyectoFigura[]) => 
      figuras.map((f: ProyectoFigura) => f.id === figuraId ? { ...f, visible: !f.visible } : f)
    );
  }
}
