import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sidebar } from './components/sidebar/sidebar';
import { Map } from './components/map/map';
import { Totales } from './components/totales/totales';
import { AuthService } from './services/auth/authService';
import { RouterOutlet } from "@angular/router";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, Sidebar, Map, Totales, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  auth = inject(AuthService);
  protected readonly title = signal('Steriá');
}
