import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TotalListensChartComponent } from './total-listens-chart.component';

describe('TotalListensChartComponent', () => {
  let component: TotalListensChartComponent;
  let fixture: ComponentFixture<TotalListensChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TotalListensChartComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TotalListensChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
