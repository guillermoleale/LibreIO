# Notas de diseño

Notas breves sobre decisiones técnicas que no se deducen del código. Las decisiones puntuales tomadas sin consultar están en `DECISIONS.md`.

## Aritmética

Todo el núcleo trabaja con `Fraction` sobre `BigInt`. Los decimales de la entrada se convierten a fracción exacta (`0.25` es `1/4`) y los decimales de la salida son solo una vista con `toDecimal(n)`, redondeando a la mitad hacia afuera del cero. Los infinitos de cotas y rangos se representan con `Extended`.

## Simplex

- El modelo se lleva a forma estándar de maximización. Una minimización se resuelve como maximización de -Z. Los resultados (Z, precios sombra, costos reducidos, rangos) se devuelven en el sentido original.
- Cada fila recibe su holgura o exceso `SLK n` y, si hace falta, su artificial `ART n`, con el número de fila de LINDO (la fila 1 es la función objetivo).
- La fila objetivo del tableau guarda `z_j - c_j` como coeficientes `aM + b` (`MValue`). Con dos fases el coeficiente de M es siempre cero. Con Big M los artificiales cuestan `-M` y el orden es lexicográfico: M domina a cualquier constante.
- La traza es una lista de tableaux. Cada uno registra la variable que entra, la que sale, la fila pivote, las razones mínimas, las filas empatadas y una nota en español. El último tableau de cada fase no tiene variable que entra.
- Dos fases: al terminar la fase 1 con suma de artificiales cero, las artificiales que quedaron básicas en cero se sacan con pivotes degenerados y se restaura la función objetivo original sobre la misma base. Las artificiales nunca vuelven a entrar.
- Big M: al detectar óptimo o ilimitado, si queda una artificial básica positiva el problema es infactible. Una dirección ilimitada con artificiales positivas no puede reducirlas, así que el original es infactible y no ilimitado.
- Óptimos alternativos: una variable no básica con costo reducido cero que puede entrar con razón mínima positiva (o sin razón, en cuyo caso hay un rayo de óptimos). Se excluyen las artificiales y la parte negativa de las variables libres.

## Sensibilidad

- La columna `B^-1 e_i` de cada fila es la de su artificial si existe, si no la de su holgura. Con ella se calculan el precio sombra (el costo reducido de esa columna, con signo según el sentido original y según si la fila se multiplicó por -1) y el rango del lado derecho.
- Rango de coeficientes: para una variable básica se miran las columnas no básicas de su fila; para una no básica el aumento permitido es el costo reducido y la disminución es infinita. En minimización se intercambian aumento y disminución porque el coeficiente interno es el opuesto.
- Precio sombra (WinQSB): variación de Z por unidad de lado derecho. Precio dual (LINDO): tasa de mejora, igual al precio sombra en maximización y opuesto en minimización.

## Método gráfico

- Los vértices se calculan de forma exacta como intersecciones de pares de rectas (restricciones y cotas) que cumplen todas las desigualdades, ordenados en sentido antihorario desde el vértice más bajo y a la izquierda.
- La región es acotada si X e Y tienen máximo finito, lo que se verifica resolviendo dos programas lineales auxiliares.
- La interfaz recorta los semiplanos a la vista en punto flotante (Sutherland–Hodgman) solo para dibujar. Los valores que se muestran siguen siendo exactos.

## Reportes

- El formato clásico reproduce el layout de LINDO. El golden de LP-01 está en `SPEC.md` y se compara carácter por carácter.
- El reporte combinado usa tablas de ancho automático con dos espacios entre columnas, texto a la izquierda y números a la derecha.

## Interfaz

- Un solo código para web y escritorio. Abrir y guardar usan los diálogos de Tauri cuando la app corre en Tauri y la carga y descarga del navegador en la web.
- Los ejemplos se leen de `examples/` en tiempo de build con `import.meta.glob`, así hay una sola copia en el repo.
- El gráfico es SVG propio. Las rectas se pintan con una lista fija de ocho colores con buen contraste en ambos temas.
- Los tests de interfaz corren con Playwright sobre la versión web compilada con el base path de GitHub Pages.

## Paramétrico

- Lado derecho: desde el tableau óptimo, `x_B(p) = x_B + (p - b0) · B^-1 e_i`; cuando una básica llega a cero se pivotea con el simplex dual (entra la columna con menor `|d_j / a_rj|` entre las negativas de la fila que sale). Si ninguna columna sirve, el problema es infactible más allá del quiebre.
- Coeficiente: si la variable es básica, los costos reducidos de las no básicas cambian con `θ · a_rk`; cuando uno llega a cero entra esa columna con el simplex primal. Si es no básica, entra cuando su costo reducido llega a cero. Si no hay razón mínima, el problema es ilimitado más allá del quiebre.
- Las dos exploraciones parten de la misma base, así que el tramo que contiene el valor actual se une en uno solo.

## Ramificación y acotamiento

- Cada nodo resuelve la relajación con las cotas acumuladas de su camino; las cotas se traducen a filas `SUB` y `SLB` de la forma estándar, así el alumno las ve en el tableau del nodo.
- Se guarda el `LPResult` completo de cada nodo para mostrar su tableau final en la pestaña Árbol.

## Transporte y asignación

- Las celdas básicas forman un árbol generador del grafo bipartito filas-columnas. Los potenciales se obtienen recorriéndolo desde `u_1 = 0`; el ciclo de una celda no básica es el camino en el árbol entre su fila y su columna más la celda.
- La sensibilidad de un costo básico se deduce de los ciclos de las celdas no básicas que pasan por él: con signo menos limita el aumento, con signo más la disminución.
- El húngaro calcula la cobertura mínima con König sobre el emparejamiento máximo de ceros, lo que garantiza que la cantidad de líneas sea la mínima en cada paso.

## Redes

- Dijkstra guarda en cada iteración la foto de todas las etiquetas (distancia, predecesor, permanente o temporal) para que la interfaz las muestre sobre el grafo.
- El flujo máximo trabaja sobre capacidades agregadas por par ordenado; los arcos paralelos reparten el flujo en proporción a su capacidad al informar.
- El viajante exacto es una búsqueda en profundidad con cota; para 10 nodos explora algunos miles de nodos en el peor caso. Held Karp sería más rápido pero no deja una traza que el alumno pueda seguir.

## PERT/CPM

- Los caminos críticos se obtienen recorriendo solo actividades con holgura total cero y exigiendo que el fin temprano de una coincida con el inicio temprano de la siguiente, para no mezclar actividades críticas de caminos distintos.
- La compresión es el programa lineal clásico de Hillier y Lieberman resuelto con el simplex exacto del núcleo, así el costo de cada duración es exacto y considera todos los caminos.

## Colas, inventarios y decisiones

- Las fórmulas de colas usan `Fraction` de punta a punta; las sumas finitas (M/M/s/K, población finita) se calculan término a término con factoriales en BigInt.
- La inversa de la normal se comparte con PERT. Para que los resultados sigan siendo fracciones, z se redondea a seis decimales antes de multiplicar.
- Los juegos se plantean como dos programas lineales con valor libre (sin desplazar la matriz) y se resuelven con el simplex exacto, así el valor y las estrategias son fracciones.

## Programación dinámica y Markov

- Las tablas de etapa de la mochila guardan, para cada capacidad, el valor de cada cantidad de unidades posible; así la interfaz muestra la recurrencia completa y no solo la decisión.
- El álgebra lineal exacta de Markov (eliminación gaussiana con pivoteo sobre fracciones) resuelve la distribución estacionaria, los tiempos medios de primer paso (un sistema por columna destino) y la matriz fundamental N = (I - Q)^-1.
