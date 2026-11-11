# Runas de Hécate

Juego web de dibujo: eliges una runa, la dibujas en la pizarra con una varita y el juego calcula un porcentaje de parecido con la runa original. Funciona con ratón y con pantalla táctil.

## Cómo ejecutarlo

Usa un servidor local. Si abres `index.html` con doble clic (`file://`), el navegador bloquea los módulos ES y la lectura de las imágenes.

- **VS Code:** instala la extensión *Live Server* (se recomienda al abrir la carpeta) y pulsa *Go Live*.
- **Terminal:** `npm start` y abre http://localhost:5173

## Estructura

```
index.html          Estructura de la página (pizarra, panel y modal de selección de runas)
css/styles.css      Estilos (tema claro/oscuro automático)
js/main.js          Punto de entrada: interfaz y flujo del juego
js/board.js         Pizarra: trazos, varita y chispas
js/scoring.js       Cálculo del % de parecido
js/runes.js         Lista de runas (nombre, título, archivo)
js/storage.js       Mejores puntuaciones (localStorage)
assets/runes/       Una máscara PNG por runa
```

## Cómo se calcula el %

El porcentaje es la similitud medida, sin curvas que lo suavicen, y la medida es estricta. El dibujo y la runa se centran y se escalan a una cuadrícula de 128×128 con la misma proporción, así que no importa dónde ni de qué tamaño dibujes. Después:

- **Línea central:** la runa se adelgaza a su esqueleto y tu dibujo se reduce a puntos sobre el trazo, así que el grosor del lápiz no cambia la nota.
- **Dirección:** cada punto lleva la orientación de su trazo. Un punto solo cuenta si está cerca de una línea de la runa **y** va en una dirección parecida. Un garabato roza muchas líneas, pero casi nunca con la orientación correcta; los puntos sueltos no cuentan.
- **Precisión:** qué tan bien encaja cada punto que has dibujado con la runa. Los trazos de más la bajan.
- **Cobertura:** qué tan bien está cubierta cada parte de la runa por tu dibujo. Las partes que faltan la bajan.

La cercanía de un punto vale 1 hasta `FLAT` celdas de distancia y baja hasta 0 en `TOL` celdas. El resultado es el producto de precisión y cobertura, y si dibujas mucha más tinta que la runa (`MAX_INK`) baja además en proporción. Antes de puntuar se prueba un pequeño margen de desplazamiento y escala (la caja envolvente es un ancla frágil) y se toma el mejor ajuste; eso no ayuda a un garabato, cuyo problema es la forma.

Resultados de referencia con 20 runas y unos 400 dibujos simulados (trazado fiel, con temblor, con trazos omitidos, garabatos, runas equivocadas):

| Tipo de dibujo | % típico | % máximo |
| --- | --- | --- |
| Trazado casi exacto | 97 | 99 |
| Buen dibujo a mano alzada | 85 | 93 |
| Dibujo flojo (deformado, faltan trazos) | 24 | 44 |
| Garabatos (zigzag, relleno, bucles, puntos) | 0–13 | 23 |
| Otra runa dibujada perfectamente | 12 | 23 |

Un círculo limpio sobre las runas de Agua o Mente (que contienen un círculo exterior) llega a ~35 %: es parecido parcial real, no un garabato. Dibujar solo la mitad de la runa da en torno a la mitad.

Para ajustar la dificultad, edita las constantes al inicio de `js/scoring.js`:

| Constante | Efecto |
| --- | --- |
| `TOL` | Distancia (en celdas) a la que un punto deja de contar. Más baja = más estricto. |
| `FLAT` | Distancia hasta la que el punto cuenta entero (margen de temblor). |
| `POWER` | Forma de la caída entre `FLAT` y `TOL` (1 lineal, 2 más seca). |
| `ANGLE_W` | Cuánto cuesta una diferencia de dirección. Más alto = más estricto con la orientación. |
| `MAX_INK` | Tinta máxima respecto a la runa antes de penalizar los trazos de más. |
| `MIN_EXTENT` | Tamaño mínimo del dibujo para poder evaluarlo. |

## Añadir una runa

1. Guarda un PNG con el trazo opaco y el fondo transparente en `assets/runes/`.
2. Añade una línea en `js/runes.js`.
