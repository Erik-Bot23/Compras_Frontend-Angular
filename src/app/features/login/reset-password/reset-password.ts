import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/service/auth-service/auth-service'; 

@Component({
  selector: 'app-reset-password',
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css',
})
export class ResetPassword {
  token = '';
  password = '';
  confirmPassword = '';

  constructor(
    private route: ActivatedRoute,
    private auth: AuthService,
    private snack: MatSnackBar,
    private router: Router
  ){
    this.token=this.route.snapshot.queryParamMap.get('token') ?? '';
  }

  save(){
    if(!this.password){
      this.snack.open('Ingrese una contraseña', '', {duration:2000});
      return;
    }

    //Validar contraseña
    if(this.password.length < 8){
      this.snack.open('Minimo 8 caracteres', '', {duration:2000});
      return;
    }

    if(this.password !== this.confirmPassword){
      this.snack.open('Las contraseñas no coinciden', '', {duration:2000});
      return;
    }

    this.auth.resetPassword(this.token, this.password).subscribe({
      next: () => {
        this.snack.open('Contraseña actualizada','',{duration:2000});
        this.router.navigate(['']);
      },
      error: () => {
        this.snack.open('Token invalido o expirado', '', {duration:2000});
      }
    });
  }
}
