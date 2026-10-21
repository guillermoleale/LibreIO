# Manual de LibreIO para alumnos

LibreIO es un programa libre y didáctico de Investigación Operativa. Reemplaza tres programas que la cátedra usaba hasta ahora: GLP (método gráfico), LINDO (lenguaje de modelos y reporte de texto) y WinQSB (suite de módulos). Este manual explica cómo cargar cada tipo de problema y cómo leer lo que el programa devuelve.

La idea central del programa es que puedas seguir a mano lo que hace. Cada algoritmo muestra su traza completa: iteraciones del simplex, ciclos del método de transporte, nodos del árbol de ramificación, etiquetas de Dijkstra, tablas por etapa de programación dinámica. Si un resultado no coincide con tu cuenta, la traza te deja ver en qué paso difiere.

## 1. Qué es LibreIO y cómo usarlo

### 1.1 Dónde conseguirlo

- Versión web, sin instalar nada: https://guillermoleale.com/LibreIO/. Funciona en la computadora, en el laboratorio de la facultad y en el celular.
- Versión de escritorio: instaladores para Windows, macOS y Linux en https://github.com/guillermoleale/LibreIO/releases. Para máquinas sin permisos de instalación hay un `.exe` portable de Windows que se ejecuta sin instalar.

Los instaladores no están firmados. En Windows, SmartScreen muestra un aviso: elegí "Más información" y después "Ejecutar de todas formas". En macOS, Gatekeeper bloquea la primera apertura: hacé clic derecho sobre la app y elegí "Abrir", o en Privacidad y seguridad elegí "Abrir de todas formas".

Las dos versiones tienen exactamente las mismas funciones. Lo que resolvés en una lo podés resolver en la otra.

### 1.2 La pantalla

La barra lateral de la izquierda lista los módulos: Programación lineal y entera, Transporte y asignación, Redes, PERT/CPM, Colas, Inventarios, Decisiones, Programación dinámica y Markov. El área de trabajo tiene dos paneles: a la izquierda cargás el modelo y a la derecha ves los resultados en pestañas. En el celular los paneles se apilan.

Abajo de cada panel de modelo hay opciones. La más usada es "Números": por defecto todo se muestra en fracciones exactas (por ejemplo `3/2`) y podés pasar a decimales. Los decimales son solo una forma de ver el mismo número: el programa calcula siempre con fracciones, así que `1/3` es `1/3` y no `0.3333`.

El botón "Tema oscuro" cambia entre tema claro y oscuro. "Acerca de" muestra la licencia y las dependencias.

### 1.3 Abrir y guardar

Cada módulo tiene un menú "Cargar un ejemplo" con modelos listos, incluidos los casos de aceptación del programa. Los ejemplos son un buen punto de partida: cargá uno parecido a tu ejercicio y modificalo.

Los botones "Abrir" y "Guardar" leen y escriben archivos de texto:

| Módulo                                                              | Extensión  | Formato                                  |
| ------------------------------------------------------------------- | ---------- | ---------------------------------------- |
| Programación lineal y entera                                        | `.lp`      | Lenguaje de modelos compatible con LINDO |
| Transporte, redes, PERT, colas, inventarios, decisiones, DP, Markov | `.io.json` | JSON legible, con un campo `type`        |

En la versión web, "Abrir" usa el selector de archivos del navegador y "Guardar" descarga el archivo. En la de escritorio se abren los diálogos del sistema.

### Copiar y exportar reportes

Cada módulo muestra su reporte en texto monoespaciado con tres botones: Copiar (al portapapeles), Exportar .txt y Exportar .md (el mismo texto dentro de un bloque de código de Markdown, listo para pegar en un informe). En cualquier módulo, Ctrl+Enter resuelve el problema cargado.

## 2. Programación lineal

### 2.1 El lenguaje de modelos

Los modelos se escriben en el formato de LINDO clásico, así que las guías de ejercicios existentes sirven tal cual. Este es el ejemplo de la cátedra:

```
TITLE Ejemplo de la cátedra
! Comentario hasta fin de línea
MAX 3X + 2Y
SUBJECT TO
  capacidad) 2X + Y <= 100
  horas)     X + Y <= 80
  demanda)   X <= 40
END
GIN X
```

Reglas:

- `TITLE` es opcional y va antes de la función objetivo.
- La primera línea del modelo es `MAX` o `MIN` seguido de la función objetivo. Puede ocupar varias líneas.
- `SUBJECT TO`, `ST`, `S.T.` o `SUCH THAT` abre las restricciones. `END` las cierra y es obligatorio.
- Una restricción por línea. La etiqueta es opcional y termina en `)`. Sin etiqueta, las filas se numeran desde 2 porque la fila 1 es la función objetivo, igual que en LINDO.
- Operadores: `<=`, `>=`, `=`. También se aceptan `<`, `>`, `=<` y `=>`.
- Términos: `3X`, `3 X`, `3*X`, `X`, `-X`. Los coeficientes pueden ser enteros, decimales o fracciones como `1/3`. Una constante del lado izquierdo (`2X + 10 <= 110`) se pasa sola al lado derecho.
- Los nombres de variables llevan letras, dígitos y guion bajo, empiezan con letra y no distinguen mayúsculas: `x1` y `X1` son la misma variable.
- Las variables son no negativas salvo que las declares después de `END`: `FREE X` (libre), `SLB X 5` (cota inferior), `SUB X 50` (cota superior), `GIN X` (entera) e `INT X` (binaria, como en LINDO). `GIN 3` e `INT 2` declaran las primeras n variables en orden de aparición.
- Los comentarios empiezan con `!` y llegan hasta el fin de la línea.
- Una variable que aparece solo en las restricciones entra en la función objetivo con coeficiente 0.

Si hay un error de sintaxis, el editor marca la línea y explica el problema en español, por ejemplo "Línea 4: La restricción no tiene operador de comparación (<=, >= o =)". El botón "Resolver" o Ctrl+Enter resuelven el modelo.

### 2.2 La vista tabular

El botón "Tabla" muestra el mismo modelo como una tabla al estilo WinQSB: una fila con los coeficientes de la función objetivo, una fila por restricción con dirección y lado derecho, y filas de cota inferior, cota superior y tipo de variable (continua, entera, binaria o libre). Lo que cambiás en la tabla se escribe en el texto y lo que cambiás en el texto se refleja en la tabla. Podés agregar variables y restricciones con los botones de abajo.

### 2.3 Método y regla de entrada

En las opciones elegís el método: "Dos fases" (por defecto) o "Big M". Con Big M el tableau muestra los coeficientes en forma simbólica, por ejemplo `-10M + 3`, sin reemplazar M por un número grande. La regla de entrada es Dantzig (entra la variable con costo reducido más negativo) o Bland (entra la primera que mejora, para evitar ciclado). Ante empate entra la variable de menor índice.

Las minimizaciones se resuelven internamente como maximización de -Z. La pestaña Modelo lo aclara y muestra la forma estándar con las holguras `SLK n` y las artificiales `ART n` numeradas por fila, más la formulación del problema dual.

### 2.4 Cómo leer el reporte combinado

La pestaña Solución muestra por defecto el reporte combinado en español, con las columnas de WinQSB. Para el ejemplo LP-01 (`MAX 3X + 2Y` con `2X + Y <= 100`, `X + Y <= 80`, `X <= 40`):

```
Óptimo encontrado en 3 iteraciones
Valor de la función objetivo: Z = 180

Variable  Valor  Coeficiente  Contribución  Costo reducido  Estado  Mín. coef.  Máx. coef.
X            20            3            60               0  básica           2           4
Y            60            2           120               0  básica         3/2           3

Restricción  Lado izq.  Dir.  Lado der.  Holgura/Exceso  Precio sombra  Mín. LD   Máx. LD
2                  100  <=         100               0              1       80       120
3                   80  <=          80               0              1       60       100
4                   20  <=          40              20              0       20  infinito
```

Significado de cada columna:

- Contribución: coeficiente por valor, cuánto aporta cada variable a Z.
- Costo reducido: siempre no negativo. Es cuánto tendría que mejorar el coeficiente de una variable no básica para que entre a la base. Las básicas tienen costo reducido 0.
- Mín. coef. y Máx. coef.: rango del coeficiente en la función objetivo en el que la base óptima no cambia. Para una variable no básica el aumento permitido es su costo reducido y la disminución es infinita.
- Holgura/Exceso: lo que sobra de una restricción `<=` o lo que excede una `>=`. Si es 0 la restricción está activa.
- Precio sombra: cuánto cambia Z por cada unidad más de lado derecho, con su signo.
- Mín. LD y Máx. LD: rango del lado derecho en el que el precio sombra sigue valiendo.

El reporte avisa cuando la solución es degenerada (una variable básica vale cero) y cuando existen soluciones alternativas (una variable no básica tiene costo reducido cero).

### 2.5 El reporte clásico

El botón "LINDO clásico" muestra el reporte en inglés con el mismo layout del programa original, para comparar con material viejo:

```
 LP OPTIMUM FOUND AT STEP      3

        OBJECTIVE FUNCTION VALUE

        1)      180.0000

  VARIABLE        VALUE          REDUCED COST
         X        20.000000          0.000000
         Y        60.000000          0.000000

       ROW   SLACK OR SURPLUS     DUAL PRICES
        2)         0.000000          1.000000
        3)         0.000000          1.000000
        4)        20.000000          0.000000
```

Una diferencia a tener en cuenta: LINDO informa precios duales y WinQSB precios sombra. El precio dual es la tasa de mejora de Z por unidad de lado derecho. En maximización coincide con el precio sombra; en minimización tiene signo opuesto. En LP-02 (`MIN 2X + 3Y` con `X + Y >= 4`, `X + 3Y >= 6`) los precios sombra son `3/2` y `1/2` y los precios duales `-1.5` y `-0.5`.

Los estados no óptimos se escriben `NO FEASIBLE SOLUTION` y `UNBOUNDED SOLUTION`. Los dos reportes se pueden copiar y exportar a `.txt` y `.md`.

### 2.6 El tableau y el modo guiado

La pestaña Tableau muestra cada iteración del simplex. Con "Anterior", "Siguiente", "Primero" y "Último" navegás los tableaux. En cada uno ves resaltados la columna de la variable que entra, la fila de la que sale, el pivote y la columna de razones mínimas. La fila Z (o W en la fase 1) tiene los costos reducidos: el tableau es óptimo cuando ninguno es negativo. Debajo hay una nota que explica el paso, por ejemplo "Entra X (costo reducido -3) y sale SLK 4 (razón mínima 40)".

El "Modo guiado" te deja hacer el simplex vos. Elegís la variable que entra y, si querés, la que sale, y el programa valida la elección antes de pivotear:

- Si elegís una variable con costo reducido que no mejora, te lo dice y no pivotea.
- Si la elección es válida pero no es la de Dantzig, avisa y pivotea igual.
- Si elegís una variable que sale sin la razón mínima, avisa que el nuevo tableau deja de ser factible.
- Cuando el tableau de la fase 1 es óptimo, el botón "Cerrar fase" pasa a la fase 2 o informa que el problema es infactible.

"Exportar tableau clásico" guarda el tableau actual en el formato `THE TABLEAU` de LINDO.

### 2.7 El método gráfico

Con dos variables de decisión la pestaña Gráfico reemplaza a GLP. Cada restricción es una recta de un color con su semiplano sombreado. La región factible queda destacada y cada vértice aparece con sus coordenadas exactas y el valor de Z. En LP-01 los vértices son (0, 0), (40, 0), (40, 20), (20, 60) y (0, 80) y el óptimo (20, 60) está marcado.

La recta de la función objetivo se desplaza con el control deslizante o con los botones "Subir Z" y "Bajar Z", como las flechas de GLP. El valor de Z se actualiza en vivo y el programa avisa cuando la recta llega al óptimo.

Casos especiales:

- Problema ilimitado (LP-03): la región es abierta y una flecha muestra la dirección en la que Z mejora sin límite.
- Problema infactible (LP-04): la región es vacía y se avisa.
- Infinitas soluciones (LP-05): la arista con todos los óptimos queda resaltada.
- Problemas enteros: se dibuja la grilla de puntos enteros dentro de la región y el óptimo entero queda marcado con un cuadrado.

Podés hacer zoom y desplazar el dibujo, exportarlo a SVG o PNG y arrastrar una recta para cambiar su lado derecho: la región y el óptimo se recalculan al instante, que es una forma visual de hacer análisis de sensibilidad. "Aplicar al modelo" escribe el cambio en el texto.

### 2.8 Sensibilidad y dual

La pestaña Sensibilidad tiene las mismas columnas del reporte combinado en tablas, más el precio dual, y debajo la formulación del problema dual con su solución. Las variables duales se llaman `Y1`, `Y2`, etc. y la función objetivo dual `W`. Para LP-02 el dual es `MAX 4 Y1 + 6 Y2` con `Y1 + Y2 <= 2` y `Y1 + 3 Y2 <= 3`, y su solución es `Y1 = 3/2`, `Y2 = 1/2`, `W = 9`.

### 2.9 Análisis paramétrico

La pestaña Paramétrico varía el lado derecho de una fila o el coeficiente de una variable en un intervalo y devuelve los tramos lineales de Z con sus quiebres. Elegís qué variar, el intervalo y "Analizar". Para LP-01 con el lado derecho de la fila 2 entre 0 y 200 hay tres tramos:

| Desde | Hasta | Z          | Base            |
| ----- | ----- | ---------- | --------------- |
| 0     | 80    | Z = 2 p    | Y, SLK 4, SLK 3 |
| 80    | 120   | Z = p + 80 | Y, SLK 4, X     |
| 120   | 200   | Z = 200    | Y, SLK 2, X     |

Los quiebres están en 80 y 120 y en cada uno se informa qué variable entra y cuál sale. El gráfico muestra Z en función del parámetro y el "Formato clásico" reproduce la tabla de LINDO PARA.

### 2.10 Programación entera

Si el modelo tiene variables `GIN` o `INT`, el programa resuelve la relajación lineal y después aplica ramificación y acotamiento. La pestaña Solución muestra el óptimo entero y el reporte clásico incluye las líneas `NEW INTEGER SOLUTION`, `BOUND ON OPTIMUM` y `ENUMERATION COMPLETE`.

La pestaña Árbol dibuja el árbol completo: cada nodo con su rama (por ejemplo `Y <= 1`), su cota y su estado (ramifica, solución entera, infactible o podado por cota). Hacé clic en un nodo o usá "Nodo anterior" y "Nodo siguiente" para ver su solución y, si querés, su tableau final. Para ILP-01 (`MAX 5X + 4Y` con `6X + 4Y <= 24`, `X + 2Y <= 6`) la relajación da (3, 3/2) con Z = 21, se ramifica en Y y el óptimo entero es (4, 0) con Z = 20 en un árbol de cinco nodos.

Por defecto se ramifica por la variable con mayor parte fraccionaria. La opción "Ramificar por" te deja elegir otra variable.

## 3. Transporte, transbordo y asignación

### 3.1 Transporte

Elegí "Transporte" en el selector de problema. La matriz tiene un origen por fila con su oferta y un destino por columna con su demanda; cada celda es el costo unitario. Podés agregar y quitar orígenes y destinos y cambiar los nombres. Para prohibir una ruta escribí `M` en la celda.

En las opciones elegís minimizar o maximizar y la solución inicial: esquina noroeste, mínimo de matriz, mínimo de fila, mínimo de columna, Vogel o Russell. Para TR-01 (ofertas 15, 25, 10; demandas 5, 15, 15, 15; costos `10 2 20 11 / 12 7 9 20 / 4 14 16 18`) la esquina noroeste cuesta 520, el mínimo de matriz 475 y Vogel 475. El óptimo con MODI cuesta 435.

La pestaña Iteraciones muestra primero los pasos de la solución inicial (qué celda se asigna y qué fila o columna se tacha, con las penalizaciones en el caso de Vogel) y después cada iteración de MODI:

- Los potenciales `u` de cada fila y `v` de cada columna al borde de la tabla.
- En cada celda básica, la cantidad asignada en negrita. En cada celda no básica, el costo reducido `c - u - v` en cursiva.
- La celda que entra es la de costo reducido más negativo. El ciclo que forma con las básicas queda resaltado con signos `+` y `−`.
- θ es el menor valor de las celdas con signo `−`, y esa celda sale.

Cuando la solución inicial tiene menos celdas básicas que filas más columnas menos uno (como Vogel en TR-01, con cinco de seis), es degenerada: el programa agrega celdas básicas en cero y lo avisa. Si la oferta total no coincide con la demanda total, agrega un origen o un destino ficticio con costo 0 y lo informa en el reporte.

La pestaña Sensibilidad muestra, para cada costo, el rango en el que la solución óptima no cambia.

### 3.2 Transbordo

En "Transbordo" cargás nodos con oferta o demanda y arcos con costo. Los nodos intermedios son los que no son origen puro ni destino puro. El programa los convierte en una matriz de transporte ampliada: cada nodo intermedio aparece como fila y como columna, con un buffer igual a la oferta total, costo 0 en su propia celda y costo `M` en los arcos que no existen. Para TR-03 (orígenes S1 con 10 y S2 con 5, intermedio T, destinos D1 con 8 y D2 con 7) el costo mínimo es 52 y pasan 10 unidades por T.

### 3.3 Asignación

En "Asignación" cargás una matriz de agentes por tareas. La pestaña Pasos muestra el método húngaro:

1. Matriz de costos (si maximizás, se cambia el signo de los costos).
2. Reducción por filas: se resta el mínimo de cada fila.
3. Reducción por columnas: se resta el mínimo de cada columna.
4. Cobertura de los ceros con la menor cantidad de líneas. Si hay tantas líneas como filas, existe una asignación óptima entre los ceros.
5. Si faltan líneas, se resta el mínimo no cubierto a las celdas sin cubrir y se suma a las cubiertas dos veces, y se vuelve al paso 4.

Para AS-01 (costos `9 2 7 / 6 4 3 / 5 8 1`) el resultado es 1 a 2, 2 a 1 y 3 a 3 con costo 9. Si hay más agentes que tareas o al revés, se agregan ficticios con costo 0. Una celda con `M` es una asignación prohibida.

## 4. Redes

El módulo Redes recibe una lista de arcos con origen, destino y peso, y una casilla "Red dirigida". Si la red no es dirigida, cada arco se recorre en los dos sentidos. En "Problema" elegís qué resolver:

- Camino mínimo (Dijkstra): elegís origen y destino. En NET-01 (arcos 1-2 con 2, 1-3 con 5, 2-3 con 2, 2-4 con 6, 3-4 con 1, 3-5 con 7, 4-5 con 2) el camino de 1 a 5 cuesta 7 por 1-2-3-4-5. La pestaña Gráfico muestra paso a paso las etiquetas: en cada iteración un nodo se hace permanente (su distancia ya no cambia) y se actualizan las etiquetas temporales de sus vecinos. Sobre cada nodo ves la distancia y desde qué nodo se llegó.
- Flujo máximo (Ford Fulkerson): elegís fuente y sumidero. En NET-02 (s-a 10, s-b 5, a-b 15, a-t 5, b-t 10) el flujo máximo es 15. Cada paso muestra un camino de aumento con su cuello de botella; el último paso muestra el corte mínimo, con {s, a, b} de un lado y {t} del otro. Las etiquetas de los arcos son flujo/capacidad.
- Árbol de expansión mínima: Kruskal examina las aristas de menor a mayor peso y rechaza las que cierran un ciclo; Prim parte de un nodo y agrega en cada paso la arista más barata que sale del árbol. En NET-03 (AB 1, BC 2, CD 3, AD 4, AC 5, BD 6) los dos dan AB, BC y CD con costo 6.
- Viajante (hasta 10 nodos): ramificación y acotamiento exacto, con las heurísticas de vecino más cercano e inserción más barata para comparar. En NET-04 (cuatro ciudades con 1-2 10, 1-3 15, 1-4 20, 2-3 35, 2-4 25, 3-4 30) el óptimo es 80 por el circuito 1-2-4-3-1 y el vecino más cercano desde 1 también da 80. En el gráfico elegís qué circuito ver.

El grafo se dibuja solo, por capas desde el nodo de partida, con la solución resaltada. La pestaña Pasos lista las notas de cada iteración y la pestaña Solución el reporte completo.

## 5. PERT/CPM

### 5.1 Tabla de actividades y CPM

Cada actividad tiene un identificador, un nombre opcional, sus predecesoras (separadas por coma) y su duración. Las casillas "Tres estimaciones (PERT)" y "Datos de compresión" agregan las columnas correspondientes.

Al resolver, la pestaña Tiempos muestra para cada actividad ES, EF, LS, LF, holgura total y holgura libre, con las críticas resaltadas. Para PERT-01 (A dura 3, B 2, C 4 después de A, D 1 después de B, E 2 después de C y D) la duración es 9, el camino crítico A-C-E y B y D tienen holgura total 4.

La pestaña Red dibuja las actividades en nodos: cada caja tiene el identificador, la duración, ES | EF arriba y LS | LF abajo, y la holgura. El camino crítico va en color. La pestaña Gantt muestra una barra por actividad desde ES hasta EF, con la holgura sombreada hasta LF.

### 5.2 PERT

Con las tres estimaciones (optimista, más probable y pesimista) el programa calcula la duración esperada `(a + 4m + b) / 6` y la varianza `((b - a) / 6)²` de cada actividad. La duración esperada del proyecto es la del camino crítico y su varianza es la suma de las varianzas de ese camino. En PERT-02 la duración esperada es 9 y la varianza 2/3.

En la pestaña PERT podés preguntar la probabilidad de terminar antes de una fecha y la fecha para una probabilidad dada. Terminar en 10 unidades tiene probabilidad Φ(1 / √(2/3)), aproximadamente 0.89.

### 5.3 Compresión

Cada actividad que se puede acortar lleva su duración de quiebre y el costo por unidad acortada (o los costos normal y de quiebre totales, de los que se deduce el costo por unidad). En "Duración objetivo" escribís a cuánto querés llegar y "Comprimir" calcula el plan de mínimo costo. La curva de costo contra duración muestra el costo de cada duración desde la normal hasta la mínima.

Para PERT-03 (A hasta 2 a 50 por unidad, C hasta 3 a 30, E hasta 1 a 80; B y D no se acortan) acortar a 7 cuesta 80 (una unidad de C y una de A) y acortar a 6 cuesta 160 (además una de E). No se puede bajar de 6 y el programa lo dice.

## 6. Colas, inventarios y decisiones

### 6.1 Colas

Elegí el modelo y cargá λ (tasa de llegadas) y μ (tasa de servicio por servidor). Según el modelo se piden también la cantidad de servidores s, la capacidad K, la población N, la varianza del tiempo de servicio o las fases k de Erlang.

| Modelo                     | Qué describe                                    |
| -------------------------- | ----------------------------------------------- |
| M/M/1                      | Un servidor, llegadas y servicios exponenciales |
| M/M/s                      | s servidores                                    |
| M/M/1/K y M/M/s/K          | Capacidad máxima K en el sistema                |
| M/M/s con población finita | N clientes posibles                             |
| M/G/1                      | Servicio con cualquier distribución (varianza)  |
| M/D/1                      | Servicio de duración fija                       |
| M/Ek/1                     | Servicio Erlang con k fases                     |

Las medidas son λ efectiva, ρ, L, Lq, W, Wq, P0, Pn y la probabilidad de esperar. Para Q-01 (M/M/1 con λ = 2 y μ = 3): ρ = 2/3, P0 = 1/3, L = 2, Lq = 4/3, W = 1 y Wq = 2/3. Para Q-02 (M/M/2 con los mismos datos): ρ = 1/3, P0 = 1/2, Lq = 1/12, L = 3/4, Wq = 1/24 y W = 3/8. Si λ es mayor o igual que la capacidad de servicio, el programa avisa que el sistema es inestable.

Con "Costos" cargás el costo por servidor y el costo de espera por cliente y unidad de tiempo; por defecto se cobra la espera de los clientes en el sistema (L) y podés elegir solo los de la cola (Lq). El "Análisis de capacidad" compara alternativas variando s, λ, μ o K y marca la de menor costo. En Q-04 (λ = 2, μ = 3, servidor 10 por hora, espera 30 por cliente y hora): s = 1 cuesta 70, s = 2 cuesta 42.5 y s = 3 aproximadamente 50.3, así que conviene s = 2.

### 6.2 Inventarios

Tres modelos:

- Lote económico (EOQ): demanda por período, costo de pedido y costo de mantener. Opcionales: costo de faltante (se admiten faltantes), tasa de producción (reposición gradual), tiempo de entrega (punto de reorden) y descuentos por cantidad (una tasa de mantenimiento y una lista de precios desde cada cantidad). Para INV-01 (demanda 1200 por año, pedido 100, mantener 6): Q* = 200, costo anual de pedir más mantener 1200, 6 pedidos por año y ciclo de 2 meses. La pestaña Nivel de inventario muestra el diente de sierra y la pestaña Costos contra Q las curvas de pedir, mantener y total.
- Una sola compra (newsvendor): costo, precio, valor de rescate y la distribución de la demanda (uniforme, normal o discreta). La razón crítica es `Cu / (Cu + Co)`. Para INV-02 (uniforme entre 100 y 200, costo 4, precio 10, rescate 2) la razón crítica es 3/4 y Q* = 175.
- Revisión continua: demanda, lote, tiempo de entrega, demanda en el tiempo de entrega (media y desvío) y nivel de servicio. Para INV-03 (media 100, desvío 20, nivel de servicio 95 %) z = 1.645, el stock de seguridad es 32.9 y el punto de reorden 132.9.

### 6.3 Tabla de pagos

Cargá alternativas por filas y estados por columnas, con las probabilidades si las conocés y el α de Hurwicz. La pestaña Criterios muestra la alternativa elegida por cada criterio y la tabla de arrepentimientos. Para DEC-01:

| Criterio                 | Alternativa | Valor |
| ------------------------ | ----------- | ----- |
| Maximax                  | A2          | 80    |
| Maximin                  | A1          | 30    |
| Laplace                  | A1          | 40    |
| Hurwicz (α = 3/5)        | A2          | 52    |
| Savage                   | A3          | 25    |
| Valor esperado           | A3          | 44    |
| Arrepentimiento esperado | A3          | 11    |
| VEIP                     |             | 11    |

Con costos en vez de ganancias elegí "minimizar costos": los criterios optimista y pesimista pasan a ser minimin y minimax.

### 6.4 Revisión bayesiana

Cargá estados con sus probabilidades a priori, alternativas con sus pagos, indicadores y las verosimilitudes `P(indicador | estado)`. El programa calcula las probabilidades de cada indicador, las posteriores, la mejor decisión para cada indicador, el valor esperado con información muestral, el VEIM y la eficiencia respecto del VEIP. Para DEC-03 (S1 0.6, S2 0.4; A1 paga 100 y -50, A2 paga 20 y 20; P(I1|S1) = 0.8, P(I1|S2) = 0.3): sin información conviene A1 con 40 y el VEIP es 28; P(I1) = 0.6, P(S1|I1) = 0.8 y P(S1|I2) = 0.3; con información el valor es 50, el VEIM 10 y la eficiencia 5/14.

### 6.5 Árboles de decisión

Un árbol se carga con una tabla de nodos (identificador, tipo decisión, azar o pago, etiqueta y pago) y una tabla de ramas (desde, hasta, etiqueta, probabilidad en las ramas de azar y pago de la rama si lo hay). La pestaña Árbol de decisión lo dibuja de izquierda a derecha: cuadrados para decisiones, círculos para azar y triángulos para pagos. Se resuelve hacia atrás: cada nodo de azar vale la esperanza de sus ramas y cada nodo de decisión vale la mejor rama, que queda resaltada; las descartadas aparecen tachadas. El ejemplo "DEC-03 como árbol de decisión" llega al mismo valor 50 que la revisión bayesiana.

### 6.6 Juegos de suma cero

Cargá la matriz de pagos del jugador de filas. El programa calcula maximin y minimax; si coinciden hay punto de silla y estrategias puras. Si no, elimina filas y columnas dominadas y resuelve las estrategias mixtas por programación lineal, con la resolución gráfica cuando el juego reducido es 2 por n o m por 2. En DEC-02 la matriz `4 3 / 1 2` tiene punto de silla en fila 1 columna 2 con valor 3, y la matriz `3 -1 / -2 2` no: la estrategia de filas es (1/2, 1/2), la de columnas (3/8, 5/8) y el valor del juego 1/2. La pestaña Resolución gráfica dibuja una recta por estrategia del rival y marca el óptimo sobre la envolvente.

## 7. Programación dinámica y Markov

### 7.1 Mochila

Cargá la capacidad y los objetos con peso, valor y unidades máximas (por defecto una). Pesos y capacidad deben ser enteros. El programa resuelve hacia atrás, una etapa por objeto, y la pestaña Tablas por etapa muestra para cada capacidad el valor de cada decisión posible, el mejor valor y la decisión elegida. Para DP-01 (capacidad 5; objetos (2, 3), (3, 4), (4, 5), (5, 6)) el valor óptimo es 7 con los objetos 1 y 2.

### 7.2 Diligencia

Cargá los arcos con costo y, si querés, las etapas (una por línea, estados separados por coma); si marcás "Deducir etapas de los arcos" se arman solas. La tabla hacia atrás calcula f de cada estado. Para DP-02 (etapas 1 a 4; arcos 1-2 4, 1-3 2, 2-4 3, 2-5 6, 3-4 5, 3-5 1, 4-6 2, 5-6 4): f(4) = 2, f(5) = 4, f(2) = 5, f(3) = 5 y f(1) = 7, con el camino 1-3-5-6. También podés maximizar.

### 7.3 Cadenas de Markov

Cargá los estados y la matriz de transición (cada fila suma 1), más una distribución inicial y una cantidad de pasos. El programa clasifica los estados (clases de comunicación, estados absorbentes y transitorios), dice si la cadena es regular o periódica y calcula:

- La distribución en n pasos y las potencias de la matriz.
- El estado estable, si la cadena es regular. Para MK-01 (matriz `0.9 0.1 / 0.5 0.5`) es (5/6, 1/6).
- Los tiempos medios de primer paso entre estados y los tiempos de recurrencia. En MK-01 ir de 2 a 1 lleva 2 en promedio, de 1 a 2 lleva 10 y la recurrencia del estado 1 es 6/5.
- El análisis de estados absorbentes con las matrices N y B: probabilidad de absorción en cada estado absorbente y pasos esperados hasta la absorción. En MK-02 (estado 1 con 0.5 a sí mismo, 0.3 al 2 y 0.2 al 3; 2 y 3 absorbentes) la absorción en 2 tiene probabilidad 0.6, en 3 tiene 0.4 y se esperan 2 pasos.

## 8. Preguntas frecuentes

**El editor marca un error con número de línea. ¿Qué hago?** Leé el mensaje: dice qué esperaba el programa en esa línea. Los errores más comunes son olvidar `END`, escribir una restricción sin operador de comparación, usar un operador desconocido como `<>` o declarar una variable que no aparece en el modelo. El panel de resultados no se actualiza hasta que el modelo se pueda leer.

**¿Qué significa "problema ilimitado"?** Que Z puede mejorar sin límite: alguna variable entra a la base y ninguna fila tiene razón mínima. En el gráfico la región es abierta en la dirección de mejora. Casi siempre falta una restricción del enunciado.

**¿Y "problema infactible"?** Que no hay ningún punto que cumpla todas las restricciones. En dos fases, al terminar la fase 1 una variable artificial sigue en la base con valor positivo; en Big M, el valor óptimo contiene a M. Revisá los sentidos de las desigualdades y los lados derechos.

**¿Qué es una solución degenerada?** Una en la que una variable básica vale cero. Aparece cuando hay empate de razones mínimas. El óptimo es válido igual, pero en el análisis de sensibilidad los rangos pueden ser más estrechos y el simplex podría ciclar; la regla de Bland lo evita.

**¿Qué son las soluciones alternativas?** Varios puntos con el mismo valor óptimo de Z. El programa las detecta cuando una variable no básica tiene costo reducido cero. En el gráfico la arista completa queda resaltada.

**¿Por qué los resultados salen como fracciones?** Porque el programa calcula de forma exacta, sin redondeos. Podés verlos en decimales con la opción "Números", pero las fracciones son las que te sirven para comparar con la cuenta a mano.

**¿Por qué LINDO y WinQSB dan precios con distinto signo?** LINDO informa el precio dual (tasa de mejora de Z) y WinQSB el precio sombra (variación de Z). En maximización coinciden; en minimización tienen signo opuesto. LibreIO muestra los dos.

**¿La aplicación usa internet?** No. Todo se resuelve en tu computadora o en el navegador, sin servidores, telemetría ni cuentas. La versión web necesita conexión solo para cargar la página.

**¿Puedo usar LibreIO en el laboratorio sin permisos de instalación?** Sí, con la versión web o con el `.exe` portable de Windows.

**¿Con qué licencia se distribuye?** GPL-3.0-or-later. Podés usarlo, estudiarlo, modificarlo y redistribuirlo bajo esa licencia. El código fuente está en https://github.com/guillermoleale/LibreIO.

**¿Cómo lo cito en un trabajo práctico?** Por ejemplo: "LibreIO, software libre de Investigación Operativa, cátedra de Investigación Operativa de la UTN Facultad Regional Rosario, versión 1.x, https://github.com/guillermoleale/LibreIO". Indicá la versión que aparece en "Acerca de".
