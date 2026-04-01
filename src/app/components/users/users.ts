import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common'; 
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule], 
  templateUrl: './users.html',
  styleUrl: './users.css'
})
export class Users {
  private http = inject(HttpClient);
  listaUsuarios: any[] = []; // Tu lista de la base de datos

  constructor() {
    this.obtenerUsuarios();
  }

  obtenerUsuarios() {
    this.http.get<any[]>('http://localhost:3000/api/users/listado').subscribe({
      next: (res) => this.listaUsuarios = res,
      error: (err) => console.error("Error cargando usuarios:", err)
    });
  }

  // Función para abrir el modal
  abrirModalCrear() {
    console.log('Abriendo modal para crear usuario...');
  }

  // Función para borrar
  borrar(id: number) {
    if(confirm('¿Estás seguro?')) {
      this.http.delete(`http://localhost:3000/api/users/eliminar/${id}`).subscribe(() => {
        this.obtenerUsuarios();
      });
    }
  }
}
