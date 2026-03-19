import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Totales } from './totales';

describe('Totales', () => {
  let component: Totales;
  let fixture: ComponentFixture<Totales>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Totales],
    }).compileComponents();

    fixture = TestBed.createComponent(Totales);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
