import { Component, signal } from '@angular/core';
import { Sidebar } from './components/sidebar/sidebar';
import { Map } from './components/map/map';

@Component({
  selector: 'app-root',
  imports: [Sidebar, Map],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('GeoProyect');
}
