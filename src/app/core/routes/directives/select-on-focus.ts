import { Directive, ElementRef, HostListener, inject } from '@angular/core';

/**
 * Selecciona todo el contenido de input al recibir el foco.
 * Uso: <input [(ngModel)]=form.price appSelectOnFocus> 
 * */ 

@Directive({
  selector: 'input[appSelectOnFocus]'
})

export class SelectOnFocus {
  private el = inject<ElementRef<HTMLInputElement>>(ElementRef);

  @HostListener('focus')
  onFocus(): void {
    this.el.nativeElement.select();
  }
}
