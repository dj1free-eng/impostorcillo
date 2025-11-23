# Diario de versiones – El Impostorcillo

Formato de versión: MAJOR.MINOR.PATCH  
- MAJOR: cambios muy gordos, que cambian bastante el juego.
- MINOR: nuevas funciones importantes, modos nuevos, etc.
- PATCH: ajustes pequeños, mejoras visuales, correcciones de fallos.

---

## [1.0.0] – Versión actual (estable)
**Estado general:**  
Primera versión “seria” y jugable del Impostorcillo con base de datos externa y mejoras visuales.

### Funciones principales
- Sistema de roles:
  - 1 impostor por ronda.
  - Resto de jugadores son ciudadanos.
- Flujo de pantallas:
  - Pantalla de inicio con botón **Nueva partida**.
  - Pantalla de configuración:
    - Selección de número de jugadores (3 a 10).
    - Nombre personalizable para cada jugador.
    - Selección de categoría de palabras.
  - Pantalla de revelación de rol:
    - Carta deslizable para ver el rol.
    - Avatar del jugador en la carta.
    - Botón **Jugador siguiente** tras ver el rol.
  - Pantalla de **Debatid y votad**.
  - Pantalla de **Revelación**:
    - Muestra la palabra secreta.
    - Indica quién era el Impostorcillo.

### Sistema de datos (palabras)
- Carga de palabras desde `data/words-es.csv`.
- Estructura: `category,word,hint`.
- Categorías actuales:
  - `comida`
  - `animales`
  - `objetos`
  - `sitios`
  - `deportes`
  - `videojuegos`
  - `transportes`
- Cada entrada incluye:
  - **word**: palabra secreta.
  - **hint**: pista corta sin comas.
- Sistema de barajas:
  - No se repiten palabras dentro de la misma categoría hasta agotar la baraja.
  - Al agotarse, la baraja se rebaraja automáticamente.
  - Categoría “Aleatorio” usa una baraja global con todas las palabras.

### Jugadores y avatares
- Cada jugador introduce su nombre en la configuración.
- Cada jugador elige su avatar haciendo clic en un icono circular.
- Avatares disponibles: `avatar1.png` a `avatar8.png` en `/img`.
- En la pantalla de rol:
  - Se muestra el **nombre del jugador en grande**.
  - Se muestra el avatar elegido.
  - Se indica el orden: `X de Y` jugadores.

### Interacción de la carta (rol)
- En móviles / dispositivos táctiles:
  - Se desliza la carta hacia arriba para ver el rol.
  - Al superar cierta altura se activa el botón **Jugador siguiente**.
  - Al soltar, la carta vuelve a su posición original.
- En escritorio (Mac/PC):
  - Botón **Mostrar rol / Ocultar rol**:
    - Sube y baja la carta con animación.
    - También activa el botón **Jugador siguiente** al mostrar el rol.
  - En dispositivos táctiles este botón se oculta automáticamente.

### Versión y control de caché
- Versión actual de la app: `1.0.0`.
- Constante global `APP_VERSION = "1.0.0"` en el JavaScript.
- La versión se muestra en la pantalla de inicio como:
  - `Versión 1.0.0`.
- La URL del CSV incluye la versión para evitar caché:
  - `data/words-es.csv?v=1.0.0`.

### Detalles técnicos
- Juego montado en una sola página `index.html`.
- Estilos en `<style>` interno (sin CSS externo).
- Lógica del juego en `<script>` al final del archivo.
- Uso de `fetch` para obtener el CSV.
- Uso de `shuffle()` para barajar las palabras.

### Problemas conocidos
- Tras muchas rondas seguidas (aprox. 30), en algún momento:
  - La app vuelve a la pantalla inicial.
  - En ciertos casos parece “colgarse”.
- Pendiente de investigar en futuras versiones.
