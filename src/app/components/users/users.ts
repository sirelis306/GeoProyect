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
        this.listaUsuarios = res.map(user => {
          let tempUser = { ...user };
          if (!tempUser.email) {
            tempUser.email = `${tempUser.username.replace(/\s+/g, '.').toLowerCase()}@empresa.com`;
          }
          return tempUser;
        });
        this.cdr.detectChanges();
      },
      error: (err) => console.error("Error cargando usuarios:", err)
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
    if (roles.ROLE_SUPER_ADMINISTRADOR) return 'Super Admin';
    if (roles.ROLE_ADMINISTRADOR) return 'Administrador';
    if (roles.ROLE_ANALISTA) return 'Analista';
    return 'Regular';
  }

  getRoleClass(roles: any): string {
    if (roles.ROLE_SUPER_ADMINISTRADOR || roles.ROLE_ADMINISTRADOR) return 'badge-admin';
    if (roles.ROLE_ANALISTA) return 'badge-editor'; // O badge-analista
    return 'badge-viewer';
  }

  getRoleIcon(roles: any): string {
    if (roles.ROLE_SUPER_ADMINISTRADOR) return 'fa-crown';
    if (roles.ROLE_ADMINISTRADOR) return 'fa-shield-alt';
    if (roles.ROLE_ANALISTA) return 'fa-chart-line';
    return 'fa-user';
  }
}
