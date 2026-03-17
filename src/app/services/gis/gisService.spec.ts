import { TestBed } from '@angular/core/testing';

import { Gis } from './gisService';

describe('Gis', () => {
  let service: Gis;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Gis);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
