import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './users.html',
  styleUrl: './users.css'
})
export class Users implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  listaUsuarios: any[] = [];

  ngOnInit() {
    this.obtenerUsuarios();
  }

  obtenerUsuarios() {
    this.http.get<any[]>('http://localhost:3000/api/users/listado').subscribe({
      next: (res) => {
        // El res ya viene con la estructura: { primerNombre, primerApellido, email, roles: {...} }
        this.listaUsuarios = res;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error("Error cargando usuarios:", err);
      }
    });
  }

  irCrearUsuario() {
    this.router.navigate(['/usuarios/nuevo']);
  }

  borrar(id: number) {
    if (confirm('¿Estás seguro?')) {
      this.http.delete(`http://localhost:3000/api/users/eliminar/${id}`).subscribe(() => {
        this.obtenerUsuarios();
      });
    }
  }

  getPrincipalRole(roles: any): string {
    if (roles.rol_super_administrador) return 'Super Admin';
    if (roles.rol_administrador) return 'Administrador';
    if (roles.rol_analista) return 'Analista';
    return 'Regular';
  }

  getRoleClass(roles: any): string {
    if (roles.rol_super_administrador || roles.rol_administrador) return 'badge-admin';
    if (roles.rol_analista) return 'badge-editor'; // O badge-analista
    return 'badge-viewer';
  }

  getRoleIcon(roles: any): string {
    if (roles.rol_super_administrador) return 'fa-crown';
    if (roles.rol_administrador) return 'fa-shield-alt';
    if (roles.rol_analista) return 'fa-chart-line';
    return 'fa-user';
  }
}
