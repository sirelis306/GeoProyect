import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token_geo');
    return new HttpHeaders({ 'Authorization': `Bearer ${token}` });
  }

  obtenerUsuarios() {
    this.http.get<any[]>('http://localhost:3000/api/users/listado', { headers: this.getHeaders() }).subscribe({
      next: (res) => {
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

  desactivar(id: number) {
    if (confirm('¿Estás seguro de que deseas desactivar este usuario? Perderá acceso al sistema.')) {
      this.http.put(`http://localhost:3000/api/users/desactivar/${id}`, {}, { headers: this.getHeaders() }).subscribe({
        next: () => this.obtenerUsuarios(),
        error: (err) => alert(err.error?.mensaje || 'Error al desactivar el usuario')
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
    if (roles.rol_analista) return 'badge-editor';
    return 'badge-viewer';
  }

  getRoleIcon(roles: any): string {
    if (roles.rol_super_administrador) return 'fa-crown';
    if (roles.rol_administrador) return 'fa-shield-alt';
    if (roles.rol_analista) return 'fa-chart-line';
    return 'fa-user';
  }
}
