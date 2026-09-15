import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/service/auth-service/auth-service'; 
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})

export class Perfil implements OnInit {
  //Se inicializa la variable
  //any:
  user: any = null;

  //Cambio de contraseña
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  showPasswordForm = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private snack: MatSnackBar
  ){}

  //Se traen los datos del usuario desde el AuthService (lee localStorage con
  //utilidades SSR-safe; un JSON corrompido devuelve null en vez de romper la app).
  ngOnInit(): void {
    this.user = this.auth.getUser();
  }

  //Abrir modal para cambiar contraseña
  togglePasswordForm(){
    this.showPasswordForm = !this.showPasswordForm;
  }

  savePassword(){
    //Validar que se rellenen todos los campos
    if(!this.currentPassword || !this.newPassword || !this.confirmPassword){
      this.snack.open('Todos los campos son obligatorios', '', {duration:2000});
      return;
    }

    //Validar que al menos sean 8 caracteres
    if(this.newPassword.length < 8){
      this.snack.open('La contraseña debe tener mínimo 8 caracteres', '', {duration:2000});
      return;
    }

    //Validar que las contraseñas coincidan
    if(this.newPassword !== this.confirmPassword){
      this.snack.open('Las contraseñas no coinciden', '', {duration:2000});
      return;
    }

    //Cambiar contraseña
    this.auth.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: () => {
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        //snack:
        this.snack.open('Contraseña actualizada correctamente', '', {duration:2000});//open:
        this.showPasswordForm = false;
      },
      error: () => {
        this.snack.open('La contraseña actual es incorrecta', '', {duration:2000});//La vieja contraseña no se escribio bien
      }
    });
  }

  //Cerrar sesión
  logout(){
    this.auth.logout();
    this.router.navigate(['']);
  }

  inicio(){
    this.router.navigate(['/cobro'])
  }
}
