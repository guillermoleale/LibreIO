# LibreIO. Especificación funcional

Estado: borrador revisado por fidelidad, 2026-10-21

## 1. Objetivo

Herramienta libre, multiplataforma y didáctica para la enseñanza de Investigación Operativa. Reproduce lo que la cátedra usaba de tres programas:

- GLP: visualizador gráfico de programación lineal en dos variables distribuido con el libro de Eppen, Gould, Schmidt, Moore y Weatherford. Campos para la función objetivo y hasta seis restricciones, región factible dibujada y flechas para desplazar la recta de la función objetivo en sentido de maximizar o minimizar
- LINDO: lenguaje de entrada de modelos, reporte de texto con solución, costos reducidos, precios duales y rangos de sensibilidad, tableau con nombres de holgura por fila, pivoteo manual y análisis paramétrico
- WinQSB: suite de módulos con entrada tabular, reporte combinado, resolución paso a paso con elección de la variable que entra, método gráfico, análisis paramétrico y módulos de redes, PERT/CPM, colas, inventarios, decisiones, programación dinámica y Markov

## 2. Usuarios

- Alumnos de Investigación Operativa de Ingeniería en Sistemas de Información, UTN FRR. Usan el programa en su computadora personal, en el laboratorio de la facultad (sin permisos de instalación) o desde el celular
- Docentes de la cátedra. Preparan ejercicios y verifican resultados
- Cualquier otra cátedra de IO de habla hispana que quiera adoptarlo

## 3. Distribución

### 3.1 Escritorio

- Tauri 2. Instaladores: `.msi` y `.exe` NSIS (Windows 10 o superior), `.dmg` (macOS 12 o superior, x64 y arm64), `.AppImage` y `.deb` (Ubuntu 22.04 o superior)
- Publicados automáticamente en GitHub Releases al crear un tag `vX.Y.Z`
- Tamaño objetivo: menos de 20 MB. Inicio en menos de 2 segundos
- Sin firma de código al principio. El README explica en dos líneas cómo pasar el aviso de SmartScreen en Windows y el de Gatekeeper en macOS
- Versión portable para Windows (un solo `.exe` sin instalador) para máquinas sin permisos

### 3.2 Web

- La misma UI compilada con Vite y publicada en GitHub Pages en cada push a `main`
- Funciona sin backend. Toda la resolución ocurre en el navegador
- Responsive: usable en pantalla de celular para cargar un modelo chico y consultar el resultado
- Sin acceso a filesystem: abrir y guardar modelos se hace con carga y descarga de archivos del navegador
- Funcionamiento sin conexión después de la primera carga (PWA con service worker, fase 6)

### 3.3 Licencia

- GPL-3.0-or-later. Archivo `LICENSE` en la raíz, encabezado SPDX en cada fuente, pantalla "Acerca de" con la licencia y la lista de dependencias de terceros con sus licencias
- Repositorio público en GitHub desde el primer commit

## 4. Lenguaje de modelos

Formato compatible con LINDO clásico, para reutilizar las guías de ejercicios existentes. LibreIO acepta un superconjunto: todo modelo LINDO válido es válido acá.

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

- `TITLE` opcional antes de la función objetivo
- Primera línea del modelo: `MAX` o `MIN` seguido de la función objetivo
- `SUBJECT TO`, `ST`, `S.T.` o `SUCH THAT` abre las restricciones. `END` las cierra
- Una restricción por línea. Etiqueta opcional al inicio terminada en `)`. Sin etiqueta, las filas se numeran desde 2 porque la fila 1 es la función objetivo, como en LINDO
- Operadores: `<=`, `>=`, `=`. También se aceptan `<`, `>`, `=<` y `=>`
- Términos: `3X`, `3 X`, `3*X`, `X`, `-X`. Coeficientes enteros, decimales o fracciones como `1/3`. Constantes de cualquier lado se normalizan al lado derecho
- Variables: letras, dígitos y guion bajo, empezando con letra. No distingue mayúsculas
- Las variables son no negativas salvo declaración después de `END`: `FREE X`, `SLB X 5` (cota inferior), `SUB X 50` (cota superior), `GIN X` (entera general), `INT X` (binaria, como en LINDO). `GIN 3` e `INT 2` declaran las primeras n variables en orden de aparición, como en LINDO
- Comentarios: `!` hasta fin de línea
- Variables que aparecen solo en restricciones se agregan a la función objetivo con coeficiente 0
- Errores de sintaxis con número de línea y mensaje en español

Además del texto, la UI ofrece entrada en tabla estilo WinQSB: fila de coeficientes de la función objetivo, una fila por restricción con dirección y lado derecho, y filas de cota inferior, cota superior y tipo de variable (continua, entera, binaria, libre). Las dos vistas se sincronizan en ambos sentidos.

## 5. Núcleo (`packages/core`)

### 5.1 Aritmética

- Clase `Fraction` sobre `BigInt`, siempre normalizada. Suma, resta, producto, división, comparación, `toDecimal(n)` y `toString()` con formato `7/3`
- Los decimales de la entrada se convierten a fracción exacta
- Infinito simbólico para rangos y cotas

### 5.2 Programación lineal

- Forma estándar: conversión automática con variables de holgura, exceso y artificiales. Nombres de holgura y exceso por fila, `SLK 2`, `SLK 3`, como en LINDO. La traza muestra el modelo transformado
- Método: simplex tableau con dos fases por defecto. Big M como opción didáctica con M simbólica (coeficientes de la forma `aM + b`)
- Regla de entrada: Dantzig por defecto, Bland como opción para evitar ciclado. Ante empate, entra la variable de menor índice
- Pivoteo manual: la API permite ejecutar un pivote eligiendo la variable que entra y opcionalmente la que sale, y valida la elección (LINDO Solve > Pivot, WinQSB Simplex Iteration > Choose Entering Variable)
- Detección de óptimo, ilimitado, infactible, óptimos alternativos y degeneración, cada caso con un mensaje explicativo
- Traza: lista de tableaux con variable que entra, variable que sale, pivote y razones mínimas
- Dual: formulación del problema dual y su solución a partir del tableau final
- Sensibilidad: costos reducidos, precios duales, rangos de coeficientes de la función objetivo y rangos de lado derecho en los que la base no cambia. Para variables no básicas el aumento permitido del coeficiente es el costo reducido y la disminución es infinita
- Convenciones de signo, porque LINDO y WinQSB difieren:
  - Costo reducido: siempre no negativo, cuánto tiene que mejorar el coeficiente para que la variable entre a la base
  - Precio sombra (WinQSB, reporte combinado): variación de Z por unidad de lado derecho, con su signo
  - Precio dual (LINDO, formato clásico): tasa de mejora de Z por unidad de lado derecho. En maximización coincide con el precio sombra, en minimización tiene signo opuesto
- Análisis paramétrico (LINDO PARA, WinQSB Perform Parametric Analysis): variar el lado derecho de una fila o el coeficiente de una variable en un intervalo y devolver los tramos lineales de Z con sus quiebres, la base en cada tramo y la variable que entra y sale en cada quiebre
- Verificación en tests contra `highs` para valor objetivo y solución

### 5.3 Programación entera

- Branch and bound sobre el simplex del punto anterior. Ramificación por la variable con mayor parte fraccionaria por defecto, con opción de elegir a mano
- Traza: árbol completo con cota, solución de cada nodo y motivo de poda. Navegable nodo por nodo
- Variables binarias y enteras generales, mezcladas con continuas
- Cortes de Gomory como opción de la fase 6

### 5.4 Transporte y asignación

- Transporte en minimización o maximización. Rutas prohibidas con costo M
- Solución inicial: esquina noroeste, mínimo de matriz (costo mínimo), mínimo de fila, mínimo de columna, Vogel y Russell, igual que WinQSB
- Optimización: MODI con traza del ciclo de cada iteración. Manejo de degeneración con celda básica en cero
- Balanceo automático con origen o destino ficticio, con aviso en el reporte
- Transbordo: reducción al problema de transporte con nodo intermedio y buffer, como en los libros, y resolución con MODI. La traza muestra la matriz ampliada
- Asignación en minimización o maximización, desbalanceada con filas o columnas ficticias, asignaciones prohibidas. Método húngaro con traza de cada reducción y cobertura
- Sensibilidad sobre costos: rango de cada costo en el que la solución no cambia

### 5.5 Redes

- Camino mínimo (Dijkstra con traza de etiquetas), flujo máximo (Ford Fulkerson con caminos de aumento y corte mínimo), árbol de expansión mínima (Kruskal y Prim)
- Viajante para hasta 10 nodos: ramificación y acotamiento exacto, con heurísticas de vecino más cercano e inserción más barata como comparación
- Entrada como lista de arcos o matriz. La UI dibuja el grafo y resalta la solución

### 5.6 PERT/CPM

- Tabla de actividades con predecesoras. Tiempos tempranos y tardíos, holgura total y libre, camino crítico
- PERT con tres estimaciones: duración esperada, varianza, probabilidad de terminar antes de una fecha dada y fecha para una probabilidad dada
- Compresión (crashing) con tiempo y costo normal y de quiebre por actividad: acortar a una duración objetivo al mínimo costo y curva de costo contra duración, como WinQSB Perform Crashing Analysis
- Diagrama de red de actividades en nodos y Gantt en la UI

### 5.7 Colas

- Modelos: M/M/1, M/M/s, M/M/1/K, M/M/s/K, M/M/s con población finita, M/G/1, M/D/1, M/Ek/1
- Medidas: λ efectiva, ρ, L, Lq, W, Wq, P0, Pn, probabilidad de esperar
- Análisis de costos: costo por servidor y costo de espera por cliente y unidad de tiempo, costo total por unidad de tiempo
- Análisis de capacidad: tabla comparativa variando s, λ, μ o K, con el costo de cada alternativa

### 5.8 Inventarios

- EOQ básico, con faltantes, con descuentos por cantidad, con tasa de producción finita, con tiempo de entrega y punto de reorden
- Una sola compra (newsvendor) con demanda discreta o continua: razón crítica y cantidad óptima
- Revisión continua con demanda incierta en el tiempo de entrega: stock de seguridad y punto de reorden para un nivel de servicio dado
- Gráficos: nivel de inventario en el tiempo y curvas de costo contra Q

### 5.9 Análisis de decisiones

- Tabla de pagos con criterios maximax, maximin, Laplace, Hurwicz, Savage, valor esperado, arrepentimiento esperado y VEIP
- Revisión bayesiana con información muestral: probabilidades posteriores, valor esperado con información muestral, VEIM y eficiencia
- Árboles de decisión con resolución hacia atrás
- Juegos de suma cero de dos jugadores: punto de silla, dominancia, estrategias mixtas por resolución gráfica en 2 por n y por programación lineal en general

### 5.10 Programación dinámica y Markov

- Programación dinámica: diligencia (camino en etapas) y mochila, con la tabla de cada etapa
- Cadenas de Markov: matriz de transición, distribución en n pasos, probabilidades de estado estable, tiempos medios de primer paso y de recurrencia, análisis de estados absorbentes

### 5.11 Reportes de texto

- Cada módulo genera un reporte en texto plano monoespaciado, copiable y exportable a `.txt` y `.md`
- Para PL hay dos formatos:
  - Reporte combinado en español, por defecto, con las columnas de WinQSB. Variables: nombre, valor, coeficiente, contribución total, costo reducido, estado en la base, mínimo y máximo permitidos del coeficiente. Restricciones: nombre, lado izquierdo, dirección, lado derecho, holgura o exceso, precio sombra, mínimo y máximo permitidos del lado derecho. Nota "Existen soluciones alternativas" cuando corresponde
  - LINDO clásico en inglés con el mismo layout del programa original, para comparar con material viejo
- Layout de referencia del formato clásico para PL:

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

 NO. ITERATIONS=       3

 RANGES IN WHICH THE BASIS IS UNCHANGED:

                           OBJ COEFFICIENT RANGES
 VARIABLE         CURRENT        ALLOWABLE        ALLOWABLE
                   COEF          INCREASE         DECREASE
        X        3.000000         1.000000         1.000000
        Y        2.000000         1.000000         0.500000

                           RIGHTHAND SIDE RANGES
      ROW         CURRENT        ALLOWABLE        ALLOWABLE
                    RHS          INCREASE         DECREASE
        2      100.000000        20.000000        20.000000
        3       80.000000        20.000000        20.000000
        4       40.000000         INFINITY        20.000000
```

Los valores corresponden al caso LP-01 del apéndice A, verificados a mano. Este texto es el test golden del formato clásico.

- Estados no óptimos en formato clásico: `NO FEASIBLE SOLUTION` y `UNBOUNDED SOLUTION`
- Tableau en formato clásico (LINDO TABL): encabezado `THE TABLEAU`, columnas `ROW`, `(BASIS)`, una por variable incluidas `SLK n` y artificiales, y `RHS`. La fila 1 lleva base `ART` y los coeficientes de la función objetivo con signo cambiado
- Programación entera en formato clásico: líneas `NEW INTEGER SOLUTION OF <Z> AT BRANCH <b> PIVOT <p>`, `BOUND ON OPTIMUM: <cota>`, `ENUMERATION COMPLETE. BRANCHES= <b> PIVOTS= <p>` y `LAST INTEGER SOLUTION IS THE BEST FOUND`, seguidas del reporte de solución. Los números de ramas y pivotes son los de la implementación propia
- Análisis paramétrico en formato clásico: tabla con variable que sale, variable que entra, fila del pivote, valor del parámetro, precio dual antes del pivote y valor de Z en cada quiebre

## 6. Interfaz

### 6.1 Diseño general

- Barra lateral con los módulos. Área de trabajo con dos paneles: modelo a la izquierda, resultados a la derecha. En celular los paneles se apilan
- Panel de resultados con pestañas según el módulo. Para PL: Modelo (formulación normalizada, forma estándar y dual, como LINDO Formulation), Solución (reporte combinado o clásico), Tableau, Gráfico, Sensibilidad, Paramétrico. Para entera se agrega Árbol
- Editor de texto con resaltado de sintaxis básico, errores en línea y menú de ejemplos incorporados. Alternancia con la vista tabular
- Tema claro y oscuro. Todo en español. Preparado para i18n aunque al principio haya un solo idioma
- Ctrl+Enter resuelve

### 6.2 Tableau

- Navegación iteración por iteración con anterior, siguiente e ir al último, como WinQSB. Pivote resaltado, columna de razones mínimas visible, variables básicas identificadas
- Selector fracción o decimal
- Modo guiado: el alumno elige la variable que entra y opcionalmente la que sale y el programa valida la elección antes de pivotear. Si la elección es válida pero no es la de Dantzig, se avisa y se pivotea igual
- Exportación del tableau actual en formato clásico de texto

### 6.3 Método gráfico (reemplazo de GLP)

- Activo solo con dos variables de decisión
- Cada restricción como recta con su semiplano sombreado en color propio. Región factible destacada. Vértices con coordenadas exactas y valor de Z en cada uno
- Recta de la función objetivo desplazable con un control deslizante y con botones de subir y bajar en pasos, como las flechas de GLP. El valor de Z se actualiza en vivo. El óptimo se marca al llegar al borde de la región
- Casos especiales: ilimitado (región abierta con flecha en la dirección de mejora), infactible, infinitas soluciones (arista resaltada)
- Para problemas enteros, grilla de puntos enteros dentro de la región y el óptimo entero marcado
- Zoom y desplazamiento. Exportación a SVG y PNG
- Interactividad inversa: arrastrar el lado derecho de una restricción o cambiar un coeficiente y ver cómo cambia la región y el óptimo, para análisis de sensibilidad visual

### 6.4 Otros módulos

- Transporte y asignación: matriz editable con ofertas y demandas, iteración por iteración en tableau con el ciclo resaltado
- Redes: lista de arcos editable y dibujo automático del grafo con layout por capas, solución resaltada, paso a paso de etiquetas o caminos de aumento
- PERT/CPM: tabla de actividades, red de actividades en nodos con el camino crítico en color, Gantt, panel de compresión con la curva de costo
- Colas: formulario de parámetros, tabla de medidas, tabla de Pn, tabla de capacidad
- Inventarios: formulario, resultados, gráfico de nivel y gráfico de costos
- Decisiones: tabla de pagos editable, resultados por criterio, árbol dibujado con resolución hacia atrás, matriz de juego
- Programación dinámica y Markov: tablas por etapa y matrices

### 6.5 Archivos

- Modelos en texto plano con extensión `.lp` (formato de la sección 4). Para los módulos no lineales, JSON legible con extensión `.io.json`
- Abrir, guardar, ejemplos incorporados por módulo

## 7. Calidad

- Tests unitarios por algoritmo con los casos del apéndice A y resultado esperado. Cobertura mínima 90 % en `core`
- Tests golden para cada formato de reporte
- Tests de propiedades: para 200 problemas aleatorios chicos, el valor objetivo coincide con `highs`
- Tests de UI mínimos con Playwright sobre la versión web: cargar ejemplo, resolver, ver gráfico
- CI falla ante error de tipos, de lint o de test

## 8. Fases

Las fases 0 y 1 se ejecutan de corrido y terminan con `v1.0.0` publicada. Cada fase cierra con sus casos de aceptación del apéndice A en verde, CI en verde en las tres plataformas y un tag.

- [x] Fase 0. Esqueleto: monorepo, `Fraction`, parser, UI vacía con un módulo de prueba, build de Tauri en las tres plataformas y deploy web en CI. Casos LP-07
- [x] Fase 1. Programación lineal: simplex, dos fases, Big M, pivoteo manual, sensibilidad, dual, reporte combinado y clásico, tableau clásico, método gráfico. Reemplaza a GLP y LINDO. Casos LP-01 a LP-08 y UI-01 a UI-03. Tag `v1.0.0`
- [x] Fase 2. Paramétrico, entera, transporte, transbordo y asignación. Casos LP-09, LP-10, ILP-01, TR-01 a TR-03, AS-01
- [ ] Fase 3. Redes, viajante y PERT/CPM con compresión. Casos NET-01 a NET-04, PERT-01 a PERT-03
- [ ] Fase 4. Colas, inventarios y decisiones. Casos Q-01 a Q-04, INV-01 a INV-03, DEC-01 a DEC-03
- [ ] Fase 5. Programación dinámica y Markov. Casos DP-01, DP-02, MK-01, MK-02
- [ ] Fase 6. Pulido: ejemplos de la cátedra, manual para alumnos, PWA sin conexión, cortes de Gomory, firma de código si hay presupuesto

## 9. Fuera de alcance

- Programación no lineal, cuadrática y por metas. Pronósticos, control de calidad, MRP, planificación agregada, secuenciación, localización, muestreo de aceptación. Simulación de colas y de PERT. Lot sizing dinámico en inventarios. Diagnóstico automático de infactibilidad tipo LINDO Debug. Pueden agregarse después como módulos independientes
- Problemas grandes. El objetivo es que un problema de examen se resuelva al instante, no competir con solvers industriales

## 10. Decisiones cerradas

- Nombre LibreIO y sin logo hasta la fase 6
- La entrada tabular se guarda como `.lp`
- El reporte por defecto de PL es el combinado en español. El clásico es una opción
- Lo que no esté acá ni en el apéndice se decide según la política de autonomía de `CLAUDE.md`

## Apéndice A. Casos de aceptación

Cada caso es un test en `packages/core/tests/<módulo>/<id>.test.ts` y un ejemplo cargable en `examples/`. Los valores están calculados a mano y se comparan exactos en fracciones salvo donde se indica aproximación. Nunca se ajusta un valor esperado para que un test pase; si hay sospecha de error en el caso, se verifica con `highs` y se anota en `DECISIONS.md`.

### Programación lineal (fase 1)

LP-01. Óptimo único. Es el modelo de la sección 4 y la base del reporte de la sección 5.11
MAX 3X + 2Y. ST 2X + Y <= 100, X + Y <= 80, X <= 40
Esperado: X = 20, Y = 60, Z = 180. Tres iteraciones con Dantzig: entra X y sale SLK 4, entra Y y sale SLK 2, entra SLK 4 y sale SLK 3. Holguras finales 0, 0, 20. Precios duales 1, 1, 0. Costos reducidos 0 y 0. Rangos de coeficientes: X en [2, 4], Y en [3/2, 3]. Rangos de lado derecho: fila 2 en [80, 120], fila 3 en [60, 100], fila 4 en [20, infinito). Vértices de la región: (0, 0), (40, 0), (40, 20), (20, 60), (0, 80). El reporte clásico coincide carácter por carácter con el texto de 5.11. El reporte combinado muestra contribución total 60 y 120, estado básica en X e Y, y los mismos rangos como mínimo y máximo permitidos

LP-02. Minimización con restricciones de mayor o igual. Dos fases y Big M dan el mismo resultado
MIN 2X + 3Y. ST X + Y >= 4, X + 3Y >= 6
Esperado: X = 3, Y = 1, Z = 9. Precios sombra 3/2 y 1/2 en el reporte combinado. Precios duales -1.5 y -0.5 en formato clásico. Dual: MAX 4U + 6V. ST U + V <= 2, U + 3V <= 3, con U = 3/2, V = 1/2, W = 9

LP-03. Ilimitado
MAX X + Y. ST X - Y <= 2, -X + Y <= 2
Esperado: estado ilimitado después de que entra X. El mensaje indica la variable que entra sin razón mínima. Formato clásico: `UNBOUNDED SOLUTION`. En el gráfico, región abierta con flecha en la dirección (1, 1)

LP-04. Infactible
MAX X + Y. ST X + Y <= 2, X + Y >= 4
Esperado: estado infactible detectado al terminar la fase 1 con una artificial positiva. En Big M, con M presente en el valor óptimo. Formato clásico: `NO FEASIBLE SOLUTION`

LP-05. Óptimos alternativos
MAX 2X + 2Y. ST X + Y <= 4, X <= 3, Y <= 3
Esperado: Z = 8 en (3, 1) con Dantzig. Una variable no básica con costo reducido 0. El reporte combinado dice que existen soluciones alternativas y el gráfico resalta el segmento entre (1, 3) y (3, 1)

LP-06. Degeneración
MAX 3X + 2Y. ST X + Y <= 4, X + 3Y <= 6, X <= 4
Esperado: empate de razones mínimas en la primera iteración. Óptimo X = 4, Y = 0, Z = 12 con una variable básica en cero. El reporte avisa que la solución es degenerada

LP-07. Parser
Entrada con TITLE, etiquetas, comentarios, coeficientes `1/3`, `3*X`, `-Y`, constantes del lado izquierdo, operadores `=<` y `=>`, y declaraciones FREE, SLB, SUB, GIN e INT en forma nominal y numérica. Esperado: modelo interno correcto. Entradas inválidas (variable que empieza con dígito, falta END, operador desconocido, restricción sin operador) producen error con número de línea y mensaje en español

LP-08. Verificación cruzada
200 problemas aleatorios con semilla fija, 2 a 6 variables, 2 a 6 restricciones, coeficientes enteros en [-9, 9] y lados derechos en [1, 50]. Esperado: mismo estado y mismo valor objetivo que `highs` con tolerancia 1e-9

LP-09. Paramétrico de lado derecho (fase 2)
LP-01 variando el lado derecho de la fila 2 entre 0 y 200
Esperado: tres tramos. En [0, 80] Z = 2b con óptimo (0, b). En [80, 120] Z = b + 80. En [120, 200] Z = 200 constante. Quiebres en 80 y 120 con Z = 160 y Z = 200

LP-10. Paramétrico de coeficiente (fase 2)
LP-01 variando el coeficiente de X entre 0 y 6
Esperado: tres tramos. En [0, 2] Z = 160 en (0, 80). En [2, 4] Z = 20c + 120 en (20, 60). En [4, 6] Z = 40c + 40 en (40, 20). Quiebres en 2 y 4

LP-11. Pivoteo manual
Sobre LP-01, pedir que entre Y en la primera iteración
Esperado: la API acepta la elección, informa que no es la de Dantzig, sale SLK 3 con razón 80 y el nuevo tableau tiene Y = 80, Z = 160. Pedir que entre una variable con costo reducido que no mejora devuelve un error explicativo sin modificar el tableau

### Programación entera, transporte y asignación (fase 2)

ILP-01. Branch and bound
MAX 5X + 4Y. ST 6X + 4Y <= 24, X + 2Y <= 6. X e Y enteras
Esperado: relajación X = 3, Y = 3/2, Z = 21. Ramifica en Y. Nodo Y <= 1: Z = 62/3. Nodo Y >= 2: (2, 2) con Z = 18, entero. Sobre Y <= 1 ramifica en X: X <= 3 da (3, 1) con Z = 19 y X >= 4 da (4, 0) con Z = 20. Óptimo X = 4, Y = 0, Z = 20. Cinco nodos en el árbol. El reporte clásico contiene las líneas `NEW INTEGER SOLUTION`, `BOUND ON OPTIMUM` y `ENUMERATION COMPLETE`

TR-01. Transporte
Ofertas 15, 25, 10. Demandas 5, 15, 15, 15. Costos por fila: 10 2 20 11 / 12 7 9 20 / 4 14 16 18
Esperado: esquina noroeste 520, mínimo de matriz 475, Vogel 475. Óptimo con MODI 435 con x12 = 5, x14 = 10, x22 = 10, x23 = 15, x31 = 5, x34 = 5. La solución de Vogel es degenerada (cinco celdas básicas de seis) y MODI tiene que manejarlo

TR-02. Transporte desbalanceado
Mismo caso con oferta de la fila 2 en 30. Esperado: destino ficticio con demanda 5 y costo 0, y aviso en el reporte

TR-03. Transbordo
Orígenes S1 con 10 y S2 con 5. Nodo intermedio T. Destinos D1 con 8 y D2 con 7. Arcos y costos: S1-T 2, S2-T 3, T-D1 1, T-D2 2, S1-D1 5, S2-D2 4
Esperado: costo mínimo 52 con S1-T 10, T-D1 8, T-D2 2, S2-D2 5. Pasan 10 unidades por T. La matriz ampliada tiene buffer 15 y costo M en los arcos inexistentes

AS-01. Asignación con método húngaro
Costos por fila: 9 2 7 / 6 4 3 / 5 8 1
Esperado: 1 a 2, 2 a 1, 3 a 3 con costo 9

### Redes y proyectos (fase 3)

NET-01. Camino mínimo
Arcos: 1-2 con 2, 1-3 con 5, 2-3 con 2, 2-4 con 6, 3-4 con 1, 3-5 con 7, 4-5 con 2
Esperado: de 1 a 5 cuesta 7 por 1-2-3-4-5

NET-02. Flujo máximo
Arcos: s-a 10, s-b 5, a-b 15, a-t 5, b-t 10
Esperado: flujo máximo 15. Corte mínimo con {s, a, b} de un lado y {t} del otro

NET-03. Árbol de expansión mínima
Aristas: AB 1, BC 2, CD 3, AD 4, AC 5, BD 6
Esperado: AB, BC, CD con costo 6, igual por Kruskal y por Prim

NET-04. Viajante
Cuatro ciudades con distancias simétricas: 1-2 10, 1-3 15, 1-4 20, 2-3 35, 2-4 25, 3-4 30
Esperado: óptimo 80 por el circuito 1-2-4-3-1. Vecino más cercano desde 1 también da 80

PERT-01. CPM
A dura 3 sin predecesoras. B dura 2 sin predecesoras. C dura 4 y sigue a A. D dura 1 y sigue a B. E dura 2 y sigue a C y D
Esperado: duración 9, camino crítico A-C-E, holgura total 4 en B y en D

PERT-02. PERT
Mismo proyecto con estimaciones optimista, más probable y pesimista: A (2, 3, 4), B (1, 2, 3), C (2, 4, 6), D (1, 1, 1), E (1, 2, 3)
Esperado: duración esperada 9, varianza del camino crítico 2/3, probabilidad de terminar en 10 unidades igual a Φ(1 / √(2/3)), aproximadamente 0.89

PERT-03. Compresión
Proyecto de PERT-01 con quiebre: A hasta 2 a 50 por unidad, C hasta 3 a 30 por unidad, E hasta 1 a 80 por unidad. B y D no se pueden acortar
Esperado: acortar a 7 cuesta 80 (una unidad de C y una de A). Acortar a 6 cuesta 160 (además una unidad de E). No se puede bajar de 6 y el reporte lo dice

### Colas, inventarios y decisiones (fase 4)

Q-01. M/M/1 con λ = 2 y μ = 3
Esperado: ρ = 2/3, P0 = 1/3, L = 2, Lq = 4/3, W = 1, Wq = 2/3

Q-02. M/M/2 con λ = 2 y μ = 3
Esperado: ρ = 1/3, P0 = 1/2, Lq = 1/12, L = 3/4, Wq = 1/24, W = 3/8

Q-03. M/D/1 con λ = 2 y μ = 3
Esperado: Lq = 2/3, L = 4/3, Wq = 1/3, W = 2/3

Q-04. Análisis de costos sobre M/M/s con λ = 2 y μ = 3
Costo de servidor 10 por hora, costo de espera 30 por cliente y hora
Esperado: s = 1 cuesta 70 por hora, s = 2 cuesta 42.5, s = 3 cuesta aproximadamente 50.3. Óptimo s = 2

INV-01. EOQ
Demanda 1200 por año, costo de pedido 100, costo de mantener 6 por unidad y año
Esperado: Q* = 200, costo anual de pedir más mantener 1200, 6 pedidos por año, ciclo de 2 meses

INV-02. Una sola compra
Demanda uniforme continua entre 100 y 200, costo 4, precio 10, valor de rescate 2
Esperado: razón crítica 3/4, Q* = 175

INV-03. Revisión continua
Demanda 1200 por año, Q = 200, tiempo de entrega 1 mes, demanda en el tiempo de entrega normal con media 100 y desvío 20, nivel de servicio 95 %
Esperado: stock de seguridad 32.9 y punto de reorden 132.9 con z = 1.645, tolerancia 0.1

DEC-01. Tabla de pagos
Alternativas A1, A2, A3. Estados S1, S2, S3 con probabilidades 0.3, 0.5, 0.2. Pagos por fila: A1: 50 40 30 / A2: 80 20 10 / A3: 60 50 5
Esperado: maximax A2, maximin A1, Laplace A1 con 40, Hurwicz con α = 0.6 A2 con 52, Savage A3 con arrepentimiento máximo 25, valor esperado A3 con 44, VEIP 11

DEC-02. Juegos de suma cero
Matriz 4 3 / 1 2: punto de silla en fila 1 columna 2 con valor 3
Matriz 3 -1 / -2 2: sin punto de silla. Estrategia mixta de filas (1/2, 1/2), de columnas (3/8, 5/8), valor 1/2

DEC-03. Revisión bayesiana
Estados S1 y S2 con probabilidades 0.6 y 0.4. Alternativas A1 con pagos 100 y -50, A2 con pagos 20 y 20. Indicadores I1 e I2 con P(I1|S1) = 0.8 y P(I1|S2) = 0.3
Esperado: sin información A1 con 40, VEIP 28. P(I1) = 0.6, posteriores P(S1|I1) = 0.8 y P(S1|I2) = 0.3. Con información 50, VEIM 10, eficiencia 5/14

### Programación dinámica y Markov (fase 5)

DP-01. Mochila
Capacidad 5. Objetos con peso y valor: (2, 3), (3, 4), (4, 5), (5, 6)
Esperado: valor 7 con los objetos 1 y 2

DP-02. Diligencia
Etapas 1 a 4. Arcos: 1-2 4, 1-3 2, 2-4 3, 2-5 6, 3-4 5, 3-5 1, 4-6 2, 5-6 4
Esperado: costo 7 por 1-3-5-6. Tabla hacia atrás: f(4) = 2, f(5) = 4, f(2) = 5, f(3) = 5, f(1) = 7

MK-01. Cadena regular
Matriz 0.9 0.1 / 0.5 0.5
Esperado: estado estable (5/6, 1/6). Tiempo medio de primer paso de 2 a 1 igual a 2, de 1 a 2 igual a 10. Tiempo de recurrencia del estado 1 igual a 6/5

MK-02. Estados absorbentes
Estado 1 transitorio con transiciones 0.5 a sí mismo, 0.3 al estado 2 y 0.2 al estado 3. Estados 2 y 3 absorbentes
Esperado: probabilidad de absorción en 2 igual a 0.6 y en 3 igual a 0.4. Pasos esperados hasta absorción 2

### Interfaz (fase 1, Playwright sobre la versión web)

UI-01. Cargar el ejemplo LP-01, resolver con Ctrl+Enter, ver Z = 180 en la pestaña Solución y tres tableaux navegables con el pivote resaltado

UI-02. Pestaña Gráfico de LP-01: cinco vértices etiquetados con sus coordenadas, el óptimo (20, 60) marcado, la recta de Z desplazable con el control y con los botones, exportación SVG con contenido

UI-03. LP-03 muestra el estado ilimitado y LP-04 el infactible, sin errores en la consola del navegador

UI-04. Alternar entre la vista de texto y la tabular de LP-01 conserva el modelo en ambos sentidos
