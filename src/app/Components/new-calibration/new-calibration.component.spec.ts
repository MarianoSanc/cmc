import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewCalibrationComponent } from './new-calibration.component';

describe('NewCalibrationComponent', () => {
  let component: NewCalibrationComponent;
  let fixture: ComponentFixture<NewCalibrationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewCalibrationComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(NewCalibrationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
