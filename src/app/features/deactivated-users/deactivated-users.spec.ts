import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeactivatedUsers } from './deactivated-users';

describe('DeactivatedUsers', () => {
  let component: DeactivatedUsers;
  let fixture: ComponentFixture<DeactivatedUsers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeactivatedUsers],
    }).compileComponents();

    fixture = TestBed.createComponent(DeactivatedUsers);
    component = fixture.componentInstance;
    // Se usa whenStable (como productos/usuarios) en vez de detectChanges para
    // no disparar ngOnInit (que hace una peticion HTTP real en el test).
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
