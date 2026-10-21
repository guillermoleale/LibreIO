TITLE LP-07 Prueba del parser
! Caso de aceptacion LP-07: etiquetas, comentarios, fracciones, constantes a la izquierda,
! operadores =< y => y declaraciones FREE, SLB, SUB, GIN e INT
MAX 3*X + 2Y - Z + 1/3 W
SUBJECT TO
  capacidad) 2X + Y + 10 <= 110    ! constante del lado izquierdo
  horas) X + Y =< 80
  demanda) X => 5
  -Y + 3 Z = 0
  2W + 4 >= X - 6
END
FREE Z
SLB X 5
SUB X 50
GIN W
INT Y
