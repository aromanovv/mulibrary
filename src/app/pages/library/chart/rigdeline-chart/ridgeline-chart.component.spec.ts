import { ComponentFixture, TestBed } from "@angular/core/testing";

import { RidgelineChartComponent } from "./ridgeline-chart.component";

describe("RigdelineChartComponent", () => {
  let component: RidgelineChartComponent;
  let fixture: ComponentFixture<RidgelineChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RidgelineChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RidgelineChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
