TITLE Ejemplo de la cátedra
! Modelo de la sección 4 de SPEC.md, con etiquetas y una variable entera
MAX 3X + 2Y
SUBJECT TO
  capacidad) 2X + Y <= 100
  horas)     X + Y <= 80
  demanda)   X <= 40
END
GIN X
