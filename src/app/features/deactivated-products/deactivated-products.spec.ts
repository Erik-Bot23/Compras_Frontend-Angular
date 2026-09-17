import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeactivatedProducts } from './deactivated-products';

describe('DeactivatedProducts', () => {
  let component: DeactivatedProducts;
  let fixture: ComponentFixture<DeactivatedProducts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeactivatedProducts],
    }).compileComponents();

    fixture = TestBed.createComponent(DeactivatedProducts);
    component = fixture.componentInstance;
    // Se usa whenStable (como productos/usuarios) en vez de detectChanges para
    // no disparar ngOnInit (que hace una peticion HTTP real en el test).
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
