import { ComponentFixture, TestBed } from "@angular/core/testing";

import { StackedChartComponent } from "./stacked-chart.component";

describe("StreamgraphComponent", () => {
  let component: StackedChartComponent;
  let fixture: ComponentFixture<StackedChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StackedChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StackedChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
