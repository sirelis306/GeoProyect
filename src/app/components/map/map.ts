import { Component, AfterViewInit, inject, ElementRef, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [],
  templateUrl: './map.html',
  styleUrl: './map.css',
})
export class Map implements AfterViewInit {
  private http = inject(HttpClient);
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  ngAfterViewInit() {
    // Crear el mapa centrado en Venezuela
    const map = L.map(this.mapContainer.nativeElement, {
      center: [7.1291, -66.1818],
      zoom: 6,
      zoomControl: false
    });

    // Capa base clara (CartoDB Positron)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© Movilnet Geo'
    }).addTo(map);

    // CARGAR EL RELIEVE (Capa 1)
    this.http.get('assets/geojson/venezuela.json').subscribe((data: any) => {
      L.geoJSON(data, {
        style: {
          color: '#FF6600', 
          weight: 1.5,
          fillColor: '#FF6600',
          fillOpacity: 0.05
        }
      }).addTo(map);
    });

    L.control.zoom({ position: 'topright' }).addTo(map);
  }
}