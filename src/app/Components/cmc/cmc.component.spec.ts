import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CmcComponent } from './cmc.component';

describe('CmcComponent', () => {
  let component: CmcComponent;
  let fixture: ComponentFixture<CmcComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CmcComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CmcComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
