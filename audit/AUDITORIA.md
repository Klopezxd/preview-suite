# Auditoría de Preview Suite 3.2.1

> **Informe histórico de la versión anterior.** Las correcciones y la validación de 3.3.0 están en [CORRECCIONES.md](CORRECCIONES.md). Sus números de línea corresponden al código de referencia, no al código actualizado. Para verificar la versión actual ejecuta `npm run check`; el verificador original de este directorio corresponde a la revisión anterior.

Fecha: 15 de octubre de 2026. Revisión de referencia: `4ae429f` (SHA completo en `results.json`).

## Dictamen

**El proyecto todavía no reúne las condiciones para afirmar que todas sus funciones están bien implementadas o que cumple un nivel excelente de ingeniería.** Hay fallos reproducibles de seguridad, conservación del trabajo, transformación de documentos y accesibilidad. La separación inicial entre configuración, aplicación, Markdown y linter es útil, pero las garantías de la documentación exceden el comportamiento comprobado.

La auditoría conserva intactos los archivos de la aplicación. Los únicos archivos añadidos son este informe, el verificador y sus resultados. No se hicieron despliegues ni cambios en cuentas externas.

## Alcance y evidencia

Se revisaron los cuatro archivos JavaScript, ambas páginas HTML, los estilos de la interfaz y de impresión, la estructura del repositorio, la configuración y las afirmaciones del README y del changelog. Se comprobó la sintaxis de los cuatro JavaScript con `node --check`, sin errores.

Las comprobaciones funcionales se ejecutaron sobre el código local en Microsoft Edge sin ventana, con las bibliotecas reales declaradas por el proyecto. El navegador y los resultados exactos constan en [results.json](results.json). El verificador [verify.cjs](verify.cjs) registra entradas, expectativas y valores observados. Los casos se eligen para cubrir flujos normales y casos problemáticos: el porcentaje de fallos **no es una medida de cobertura ni un porcentaje de funciones defectuosas**. Varios casos corresponden a una misma causa.

Resultado final: **61 comprobaciones, 31 satisfactorias y 30 discrepancias**, agrupadas en los 15 hallazgos siguientes: cuatro P1 y once P2. Se registró además un error de inicialización de Prism, repetido en cada carga completa.

La ejecución bloquea fuentes externas, hojas de estilo de CDN y recursos externos no declarados en su lista de scripts. Por ello, las comprobaciones de impresión y móvil validan visibilidad y comportamiento, no fidelidad tipográfica ni una revisión visual exhaustiva. La carrera de lectura de archivos usa una finalización controlada de `FileReader`. No se verificó una instalación real de Moodle, Safari, Firefox, el portapapeles del sistema, reproducción de YouTube, infraestructura de producción ni un escenario completo de funcionamiento sin red. Tampoco se midió cobertura de todas las ramas o rendimiento bajo carga.

Prioridades: **P1** = corregir antes de recomendar el uso con documentos externos o trabajo importante; **P2** = defecto funcional o de calidad que debe resolverse después. Las observaciones de ingeniería se distinguen de los defectos reproducidos.

## Hallazgos

### 1. P1 — El documento puede ejecutar JavaScript dentro de la aplicación

Ubicaciones: [app.js:550](../js/app.js#L550), [markdown.js:206](../js/markdown.js#L206), [app.js:440](../js/app.js#L440).

Ambos modos escriben el contenido en `innerHTML` dentro del mismo documento, sin sanitización ni un contexto aislado. Se reprodujo con esta entrada inofensiva:

```html
<img src="/missing-audit-image" onerror="document.body.dataset.auditExecuted='yes'">
```

En Moodle y Markdown apareció `document.body.dataset.auditExecuted === 'yes'`. Es una ejecución real, no una deducción basada solamente en el uso de `innerHTML`. El código importado puede acceder al editor y al estado expuesto en el DOM, modificar la interfaz y usar las capacidades disponibles para ese origen. Un enlace Markdown con `javascript:` también conserva ese protocolo. Una etiqueta `style` importada puede alterar la interfaz global aunque no ejecute JavaScript.

Mermaid se configura además con `securityLevel: 'loose'`; esta observación amplía la superficie de contenido activo, pero no se presenta como un exploit independiente demostrado de Mermaid.

Corrección: definir una política explícita de contenido permitido; sanitizar el HTML final y validar protocolos de enlaces. Para un previsualizador que necesita HTML amplio, aislar el documento en un `iframe sandbox` sin ejecución ni acceso al origen de la aplicación. Revisar la integración de KaTeX y Mermaid dentro de ese aislamiento. No confiar en Marked como sanitizador: su [documentación oficial](https://marked.js.org/using_advanced) recomienda una biblioteca específica. Mermaid [documenta](https://mermaid.js.org/config/schema-docs/config-properties-securitylevel.html) que `loose` permite HTML e interacciones.

### 2. P1 — Cambiar de modo puede destruir el borrador del destino

Ubicación: [app.js:218](../js/app.js#L218).

Reproducción: escribir `BORRADOR MARKDOWN`, navegar a Moodle mediante el hash conservando su plantilla intacta y pulsar el conmutador de modo. `handleSmartModeSwitch()` reemplaza el buffer y el historial de Markdown por la plantilla inicial sin comprobar si el destino tiene cambios. El borrador desaparece y se pierde su historial de recuperación.

Corrección: navegar al buffer existente sin reescribirlo. La creación de un documento nuevo y la transformación deben ser operaciones explícitas que protejan también el documento de destino.

### 3. P1 — Deshacer antes del debounce pierde el último estado

Ubicaciones: [app.js:331](../js/app.js#L331), [app.js:358](../js/app.js#L358).

Reproducción: escribir `A`, esperar a que se registre, escribir `AB` y ejecutar inmediatamente Ctrl+Z. Se recupera la plantilla anterior en vez de `A`. Después de esperar, Ctrl+Y tampoco recupera `AB`. `undoChange()` mueve el índice sin consolidar el texto actual ni cancelar el registro pendiente; ese temporizador modifica la pila después del deshacer.

Corrección: consolidar el estado pendiente antes de navegar el historial, cancelar el temporizador y conservar el cursor. Aplicar el mismo contrato al cambiar de modo, cargar archivos, transformar y restablecer documentos. El límite de 50 entradas no sustituye un límite de memoria por bytes.

### 4. P1 — La conversión HTML → Markdown pierde contenido y estructura

Ubicaciones: [markdown.js:393](../js/markdown.js#L393), [markdown.js:516](../js/markdown.js#L516), [markdown.js:535](../js/markdown.js#L535).

Se comprobaron cuatro pérdidas independientes:

| Entrada HTML | Salida observada | Efecto |
| --- | --- | --- |
| `<p>Foto <img src="foto.png" alt="Ejemplo"></p>` | `Foto` | Desaparece la imagen. |
| Lista con `Padre` y sublista `Hijo` | Dos elementos al mismo nivel | Se pierde la jerarquía. |
| `<ol start="4"><li>Cuarto</li></ol>` | `1. Cuarto` | Cambia la numeración. |
| `<p>*literal*</p>` | `*literal*` | El texto literal pasa a ser énfasis al renderizarlo. |

Corrección: usar un convertidor probado y configurar reglas para las extensiones del proyecto, o completar el actual con un contrato de preservación y pruebas de ida y vuelta. Escapar texto y destinos según su contexto, manejar imágenes, numeración e indentación y detectar elementos no representables antes de informar éxito.

### 5. P2 — La exportación a Moodle contiene controles y diagramas sin generar

Ubicaciones: [markdown.js:363](../js/markdown.js#L363), [markdown.js:132](../js/markdown.js#L132), [app.js:587](../js/app.js#L587).

`compileToMoodleHtml()` reutiliza el renderizador de interfaz. Para un bloque Mermaid exporta dos botones, referencias a símbolos SVG del documento de la aplicación y `Cargando diagrama...`, sin un SVG del diagrama. Tras pulsar Transformar a Moodle, el problema sigue visible en la propia suite: Moodle no ejecuta `renderMermaidDiagrams()`.

Corrección: separar la generación de documentos exportables del renderizado interactivo. Definir una salida autocontenida compatible con el destino; generar los diagramas antes de exportar, retirar controles y referencias al sprite y comprobar el resultado en Moodle. La política de filtrado de la instalación de Moodle aún requiere validación real.

### 6. P2 — El procesamiento de notas al pie modifica bloques de código

Ubicaciones: [markdown.js:43](../js/markdown.js#L43), [markdown.js:318](../js/markdown.js#L318).

Se extraen definiciones y referencias con expresiones regulares antes de proteger el código. Una definición `[^a]: literal` dentro de un bloque cercado se elimina y puede consumir incluso el cierre del bloque. Además, una línea posterior sin sangría se absorbe como parte de la nota, y `**negrita**` en la definición no se procesa como Markdown. Referencias repetidas también generan identificadores `fnref` duplicados según el código actual.

Corrección: implementar notas mediante tokens/extensiones del parser, con alcance explícito de bloques y referencias únicas. Procesar su contenido con las reglas de Markdown sin reintroducir HTML inseguro.

### 7. P2 — El resaltado `==texto==` altera código literal

Ubicaciones: [markdown.js:86](../js/markdown.js#L86), [markdown.js:325](../js/markdown.js#L325).

Tanto `` `==literal==` `` como el mismo contenido dentro de un bloque cercado terminan mostrando `<mark>literal</mark>` como texto de código. Los fragmentos protegidos en `protectMathDelimiters()` ya se restauraron cuando se aplica `processHighlights()`.

Corrección: una extensión inline del parser que respete el contexto de código. Evitar transformaciones globales del texto antes del análisis sintáctico.

### 8. P2 — Tab elimina la selección en vez de indentarla

Ubicación: [app.js:1301](../js/app.js#L1301).

Seleccionar `texto seleccionado` y pulsar Tab deja solamente dos espacios. El controlador concatena el prefijo y el sufijo excluyendo todo el rango seleccionado. Contradice la función de indentación anunciada en el README y puede borrar varias líneas.

Corrección: indentar las líneas alcanzadas por la selección, conservar el texto y ajustar los límites de selección. Registrar la operación como una sola edición deshacible.

### 9. P2 — Una lectura pendiente puede sobrescribir otro modo

Ubicación: [app.js:958](../js/app.js#L958).

`reader.onload` usa `state.currentMode` y el editor en el momento de finalizar. Una lectura iniciada en Moodle y completada tras navegar a Markdown escribe el archivo de Moodle sobre el buffer de Markdown. La prueba controla el orden de finalización de `FileReader`; no depende de que un archivo pequeño tarde lo suficiente.

Corrección: capturar el destino y una versión de la operación al iniciarla. Cancelar o descartar resultados obsoletos y evitar que lecturas anteriores sobrescriban ediciones posteriores o archivos más recientes.

### 10. P2 — El linter ignora el orden y los cierres huérfanos

Ubicación: [linter.js:29](../js/linter.js#L29).

`</table><table>` y `\] \[` devuelven `null`, aunque el orden está invertido. El código cuenta todas las aperturas de una línea antes de procesar sus cierres y descarta los cierres sin apertura. Una tabla válida que cierra después de la línea 10 000 se informa falsamente como no cerrada.

Corrección: recorrer tokens en orden, reconocer cierres huérfanos y diferenciar un análisis incompleto de un documento inválido. Aclarar qué validación heurística se ofrece y no usarla como garantía de validez HTML o equivalencia con Moodle.

### 11. P2 — El paquete de Prism produce un error al cargar C++

Ubicación: [index.html:46](../index.html#L46).

El paquete combinado carga `prism-cpp` sin cargar antes `prism-c`. Se observa `Cannot set properties of undefined (setting 'class-name')` en la dependencia combinada y `Prism.languages.cpp` no está definido. Ocurre con la respuesta real del CDN. El autoloader podría intentar recuperar lenguajes después; no elimina el error inicial ni garantiza la inicialización correcta del paquete.

Corrección: respetar las dependencias y el orden de los lenguajes o dejar su carga a un único mecanismo. Añadir una comprobación de arranque sin errores y un bloque C++ como aceptación.

### 12. P2 — Los modales y algunos controles no son operables completamente con teclado

Ubicaciones: [app.js:980](../js/app.js#L980), [app.js:1098](../js/app.js#L1098), [index.html:188](../index.html#L188).

Abrir el modal de atajos no mueve el foco dentro. El logo tiene `role="button"` y `tabindex="0"`, pero Enter no lo activa. Los modales solo cambian clases: no contienen el foco ni desactivan el fondo. Tampoco hay restauración explícita del foco. El estado del botón Deshacer se simula con opacidad y `pointerEvents`, sin `disabled`.

Corrección: preferir controles nativos y `<dialog>` con gestión de foco apropiada, o implementar íntegramente el patrón modal. Verificar teclado y lector de pantalla. Las tarjetas del hub sí admitieron Enter y Escape sí cerró el modal probado; eso no permite afirmar conformidad WCAG de toda la aplicación.

### 13. P2 — Se muestra «¡Copiado!» aunque el portapapeles rechace la operación

Ubicaciones: [app.js:843](../js/app.js#L843), [app.js:1210](../js/app.js#L1210).

Se simuló un rechazo de `navigator.clipboard.writeText()`. `copyTextSafely()` captura el error sin devolver el resultado y su llamador muestra igualmente `¡Copiado!`. El mismo patrón aparece en varios botones. Además, el resultado booleano de `document.execCommand('copy')` se ignora.

Corrección: devolver éxito/fracaso o propagar un error tipado y actualizar el estado visual solo si hubo éxito. Comprobar la alternativa de copia y restaurar el foco después de usar el textarea temporal.

### 14. P2 — El parser de respaldo no reconoce las alertas que intenta soportar

Ubicación: [markdown.js:233](../js/markdown.js#L233).

Con Marked indisponible, `# Sin red` produce un encabezado, pero `> [!NOTE]` no produce una alerta. Primero se convierte `>` en `&gt;` y después se buscan expresiones que empiezan por `>`, por lo que esas reglas son inalcanzables. Las citas tienen el mismo problema de orden según la inspección del código. El respaldo tampoco ofrece paridad general con GFM.

Corrección: establecer un subconjunto de respaldo explícito y probarlo con el CDN bloqueado desde el arranque. Si se promete experiencia completa sin conexión, distribuir localmente las dependencias necesarias y comprobar la carga sin caché.

### 15. P2 — Las tablas Markdown pierden su sección de encabezado

Ubicación: [markdown.js:186](../js/markdown.js#L186).

El renderer concatena `header` y `body` sin `thead`/`tbody`. Al analizar la salida se observa que no existe `thead`. Aunque sobrevivan celdas `th`, se pierde la sección semántica y no pueden aplicarse correctamente las reglas que dependen de ella.

Corrección: generar las secciones correspondientes y mantener alineación, estructura y encabezados en vista previa y exportación.

## Prácticas de ingeniería y Clean Code

**Bases favorables:** nombres de funciones comprensibles, configuración centralizada, `const`/`let`, modo estricto, encapsulación por archivo, metadatos de alertas en una estructura común, delegación de eventos en la vista previa y controles de extensión/tamaño de archivos. La carga válida, el rechazo de archivos no admitidos y mayores de 5 MB, la descarga de contenido, la restauración de plantilla y su deshacer funcionaron en los casos comprobados. También funcionaron renderizado HTML, matemáticas de la plantilla, encabezados y tareas Markdown, alertas con Marked, Mermaid en Markdown, tema, zoom del editor, vistas móviles y visibilidad básica de impresión.

**Brechas estructurales:**

- `app.js` concentra estado, historial, navegación, lectura y descarga de archivos, renderizado, accesibilidad, diálogos, gestos y controles. Separar por responsabilidades y contratos permite probarlos sin depender del DOM completo. No hace falta migrar de framework para conseguirlo.
- `MarkdownEngine` mezcla interpretación, HTML de interfaz y exportación. La misma salida sirve a consumidores con requisitos diferentes; el fallo de Mermaid exportado es una consecuencia concreta.
- Hay dos implementaciones de `escapeHtml`, valores `300`, límites de historial y medidas repartidas, además de operaciones muy similares para los dos controles de zoom. Consolidar las partes estables y mantener visibles las diferencias reales.
- Varias capturas de errores convierten fallos en advertencias o resultados aparentemente exitosos. `window` registra todos los errores como «no críticos», y el render puede mostrar «Listo» aunque una etapa anterior haya fallado. Establecer resultados explícitos y conservar el estado de fallo de cada etapa.
- Las dependencias se declaran mediante etiquetas CDN; Mermaid solo fija la versión mayor (`@10`). No hay archivo de bloqueo, integridad SRI, inventario automatizado ni proceso visible de actualización. Fijar versiones verificadas y controlar artefactos remotos. Esto no equivale a afirmar que una versión concreta tenga una vulnerabilidad conocida.
- Antes de esta auditoría no hay suite de pruebas, manifiesto de herramientas de calidad ni flujo de CI versionado. EditorConfig define formato, pero no valida comportamiento ni garantiza que el formato se aplique. Añadir lint, formateo comprobable y regresiones de los defectos encontrados.
- El límite de 5 MB se aplica al archivo, no a pegar texto ni a todas las estructuras derivadas. La numeración genera un nodo por línea y el historial guarda documentos completos hasta 50 entradas. Hay riesgo de consumo excesivo; no se hizo una prueba de saturación ni se afirma un umbral de bloqueo medido.
- Los borradores solo residen en memoria; `SafeStorage` conserva el tema. No hay recuperación de documentos tras recargar. Debe documentarse y, si la conservación es un requisito del producto, añadirse persistencia con manejo de cuotas y recuperación visible.
- El README afirma «simulación exacta», «blindada», «sin conexión ni dependencias», «especificación completa» y accesibilidad universal. Son garantías no sustentadas por las pruebas presentes. Sustituirlas por capacidades verificadas, límites y requisitos concretos.

Clean Code no es una certificación única ni se demuestra por longitud de archivo o cantidad de comentarios. Aquí deben priorizarse fidelidad del contenido, invariantes de estado, límites de confianza y resultados verificables sobre refactorizaciones cosméticas.

## Orden recomendado de corrección

1. Resolver ejecución de contenido importado y proteger borradores e historial. Usar los casos P1 como aceptación obligatoria.
2. Establecer contratos de conversión y exportación; corregir pérdidas, notas al pie, código literal y Mermaid.
3. Corregir edición, operaciones asíncronas, linter, dependencias y mensajes de éxito.
4. Completar accesibilidad y comprobaciones reales del destino Moodle; ampliar navegador, impresión y funcionamiento sin red.
5. Separar responsabilidades progresivamente y ejecutar lint y regresiones en CI. Ajustar la documentación a la evidencia.

## Reproducción

Requiere Node.js, Microsoft Edge y Playwright disponible. En este entorno se usó el módulo ya instalado por el runtime de Codex, sin instalar dependencias en la aplicación:

```powershell
$env:PLAYWRIGHT_MODULE='C:/Users/lklev/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node audit/verify.cjs
```

En otro equipo, apuntar `PLAYWRIGHT_MODULE` a una instalación de Playwright o instalarlo en un entorno de auditoría aislado. El script descarga los scripts públicos ya utilizados por el proyecto; necesita conexión. Guarda `audit/results.json` y devuelve código 1 si existen discrepancias, que es lo esperado para la revisión auditada. Un error de infraestructura también devuelve 1, pero imprime el error en lugar de un informe final. No interpreta una ejecución incompleta como una auditoría satisfactoria.
