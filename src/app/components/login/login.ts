import { Component, inject } from '@angular/core';
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
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);

  creds = { username: '', password: '' };
  error = '';
  cargando = false;

  ingresar() {
    this.cargando = true;
    this.error = '';

    this.auth.login(this.creds).subscribe({
      next: (res) => {
        console.log('Login exitoso', res);
        this.router.navigate(['/map']);
      },
      error: (err) => {
        this.cargando = false;
        this.error = 'Usuario o contraseña incorrectos';
      }
    });
  }
}