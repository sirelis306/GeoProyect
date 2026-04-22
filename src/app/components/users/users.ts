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
    // Lista de usuarios "quemada" para simular el funcionamiento sin backend
    this.listaUsuarios = [
      {
        id: 1,
        primerNombre: 'Kevin',
        primerApellido: 'Mendoza',
        email: 'kevinmendoza@gmail.com',
        cargo: 'Analista',
        roles: { rol_super_administrador: true, rol_administrador: true, rol_analista: true, rol_regular: true }
      },
      {
        id: 2,
        primerNombre: 'Sirelis',
        primerApellido: 'Sarmiento',
        email: 'sirelissarmiento@gmail.com',
        cargo: 'Apoyo Técnico',
        roles: { rol_super_administrador: false, rol_administrador: false, rol_analista: true, rol_regular: true }
      }
    ];

    // Incluir al usuario que inició sesión actualmente
    const currentUserJson = localStorage.getItem('user_geo');
    if (currentUserJson) {
      const currentUser = JSON.parse(currentUserJson);
      if (!this.listaUsuarios.find(u => u.email === currentUser.email)) {
        this.listaUsuarios.push({
          ...currentUser,
          primerNombre: currentUser.nombre?.split(' ')[0] || 'Usuario',
          primerApellido: currentUser.nombre?.split(' ')[1] || 'QA',
          cargo: 'QA'
        });
      }
    }
    this.cdr.detectChanges();
  }

  irCrearUsuario() {
    this.router.navigate(['/usuarios/nuevo']);
  }

  desactivar(id: number) {
    if (confirm('¿Estás seguro de que deseas desactivar este usuario? Perderá acceso al sistema.')) {
      this.http.put(`http://localhost:3000/api/users/desactivar/${id}`, {}, { headers: this.getHeaders() }).subscribe({
      // this.http.put(`https://geobackend-api.onrender.com/api/users/desactivar/${id}`, {}, { headers: this.getHeaders() }).subscribe({
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
