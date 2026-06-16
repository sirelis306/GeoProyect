import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth/authService';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  creds = { email: '', password: '' };
  error = '';
  cargando = false;
  verPassword = false;

  ngOnInit() {
    // Si ya está logueado, lo mandamos al mapa o a cambiar contraseña según corresponda
    if (this.auth.estaLogueado()) {
      const user = this.auth.currentUser();
      if (user && (user.cambiar_password === true || user.cambiar_password === 1)) {
        this.router.navigate(['/cambiar-contrasena']);
      } else {
        this.router.navigate(['/mapa']);
      }
    }
  }

  ingresar() {
    this.cargando = true;
    this.error = '';

    this.auth.login(this.creds).subscribe({
      next: (res) => {
        this.cargando = false;
        console.log('Login exitoso', res);
        
        const user = this.auth.currentUser();
        if (user && (user.cambiar_password === true || user.cambiar_password === 1)) {
          this.router.navigate(['/cambiar-contrasena']);
        } else {
          this.router.navigate(['/mapa']);
        }
      },
      error: (err) => {
        this.cargando = false;
        this.error = 'Usuario o contraseña incorrectos';
      }
    });
  }
}