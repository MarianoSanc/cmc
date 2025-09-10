import { Routes } from '@angular/router';
import { HomeComponent } from './Components/home/home.component';
import { CmcComponent } from './Components/cmc/cmc.component';
import { NewCalibrationComponent } from './Components/new-calibration/new-calibration.component';

export const routes: Routes = [
    { path: '', component: CmcComponent },
    { path: 'new', component: NewCalibrationComponent },
    { path: 'view', component: CmcComponent }
];
