import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sidebar } from './components/sidebar/sidebar';
import { AuthService } from './services/auth/authService';
import { RouterOutlet } from "@angular/router";
import { Gis } from './services/gis/gisService';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, Sidebar, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  auth = inject(AuthService);
  gis = inject(Gis);
  protected readonly title = signal('Steriá');
}
