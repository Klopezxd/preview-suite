/**
 * Configuración global del sistema y plantillas académicas iniciales.
 * @module config
 * @version 3.2.3
 */
(() => {
  'use strict';

  const CONFIG = {
    VERSION: '3.2.3',
    FONT_SIZE_MIN: 10,
    FONT_SIZE_MAX: 26,
    DEFAULT_FONT_SIZE: 14,
    PREVIEW_ZOOM_MIN: 50,
    PREVIEW_ZOOM_MAX: 200,
    DEFAULT_PREVIEW_ZOOM: 100,
    PREVIEW_ZOOM_STEP: 10,
    DEBOUNCE_DELAY_MS: 300,
    TOAST_DURATION_MS: 2400,
    MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB máximo de seguridad
    ALLOWED_EXTENSIONS: ['.html', '.htm', '.md', '.markdown', '.txt']
  };

  /** Mapeo de pares de delimitadores para auto-cierre y envoltura contextual. */
  const AUTO_CLOSE_MAP = {
    '<': '>',
    '(': ')',
    '[': ']',
    '{': '}',
    '"': '"',
    "'": "'",
    '`': '`'
  };

  /** Delimitadores de cierre para salto inteligente (overtype). */
  const CLOSING_DELIMITERS = new Set(['>', ')', ']', '}', '"', "'", '`']);

  /**
   * Plantilla académica base para Moodle (HTML semántico continuo con KaTeX).
   */
  const DEFAULT_MOODLE_TEMPLATE = `<!-- DIRECTIVA DE FORMATO PARA LA IA:
  - Genera contenido académico continuo y fluido para Moodle sin elementos ocultos.
  - Usa fórmulas matemáticas en LaTeX delimitadas con \\( ... \\) en línea y \\[ ... \\] en bloque.
  - NO agregues cajas de alerta coloreadas (alert-info, alert-success, etc.) a menos que se soliciten expresamente.
  - Presenta las explicaciones y la respuesta final en párrafos naturales y limpios.
-->

<h1>Cálculo Diferencial y Modelado Matemático</h1>
<p>Dada la función compuesta \\( h(x) = x^2 \\cdot \\cos(x) \\), se requiere determinar su derivada analítica aplicando la regla del producto y evaluar la tasa de cambio instantánea en el punto \\( x = \\pi \\).</p>

<h2>1. Fundamentación Teórica</h2>
<p>Si \\( f(x) \\) y \\( g(x) \\) son funciones diferenciables, la derivada de su producto se calcula mediante la fórmula:</p>
\\[ \\frac{d}{dx}\\left[ f(x) \\cdot g(x) \\right] = f'(x)g(x) + f(x)g'(x) \\]

<h2>2. Desarrollo Analítico</h2>
<p>Identificando las funciones: \\( f(x) = x^2 \\implies f'(x) = 2x \\), y \\( g(x) = \\cos(x) \\implies g'(x) = -\\sin(x) \\). Aplicando la regla de derivación:</p>
\\[ \\frac{d}{dx}\\left[ x^2 \\cdot \\cos(x) \\right] = (2x)\\cos(x) + x^2(-\\sin(x)) = 2x\\cos(x) - x^2\\sin(x) \\]

<h2>3. Tabla de Puntos Evaluados</h2>
<table class="table table-bordered table-striped">
  <thead>
    <tr>
      <th>Punto \\( x \\)</th>
      <th>Valor \\( h(x) \\)</th>
      <th>Derivada \\( h'(x) \\)</th>
      <th>Comportamiento</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>\\( 0 \\)</td>
      <td>\\( 0 \\)</td>
      <td>\\( 0 \\)</td>
      <td>Punto estacionario</td>
    </tr>
    <tr>
      <td>\\( \\frac{\\pi}{2} \\)</td>
      <td>\\( 0 \\)</td>
      <td>\\( -\\frac{\\pi^2}{4} \\approx -2.467 \\)</td>
      <td>Pendiente negativa (decreciente)</td>
    </tr>
    <tr>
      <td>\\( \\pi \\)</td>
      <td>\\( -\\pi^2 \\approx -9.870 \\)</td>
      <td>\\( -2\\pi \\approx -6.283 \\)</td>
      <td>Rápido descenso</td>
    </tr>
  </tbody>
</table>

<h2>4. Comprobación Computacional en Python</h2>
<p>Validación simbólica del resultado mediante la librería SymPy:</p>
<pre class="language-python"><code class="language-python">import sympy as sp

# Definición de la variable simbólica y la función
x = sp.Symbol('x')
h = x**2 * sp.cos(x)

# Cálculo simbólico de la primera derivada
derivada = sp.diff(h, x)
print(f"Derivada exacta: {derivada}")

# Evaluación numérica en x = pi
valor_evaluado = derivada.subs(x, sp.pi)
print(f"Evaluación en pi: {valor_evaluado.evalf():.4f}")</code></pre>

<h2>5. Respuesta Final</h2>
<p>Al evaluar analíticamente en el punto \\( x = \\pi \\), recordando que \\( \\cos(\\pi) = -1 \\) y \\( \\sin(\\pi) = 0 \\):</p>
\\[ h'(\\pi) = 2(\\pi)(-1) - (\\pi)^2(0) = -2\\pi \\approx -6.28318 \\]
<p><strong>Conclusión:</strong> La tasa de cambio instantánea en \\( x = \\pi \\) es exactamente \\( -2\\pi \\) (aproximadamente \\( -6.2832 \\)), lo que indica que la función decrece con una pendiente negativa en dicho instante.</p>`;

  /**
   * Plantilla académica base para Markdown (GFM + Mermaid + Alertas + KaTeX + Código).
   */
  const DEFAULT_MARKDOWN_TEMPLATE = `# Análisis Numérico y Modelado Matemático

> [!IMPORTANT]
> **El Primer Mandamiento del Desarrollo:**
> **La autoevaluación sincera y continua.** Todo modelo computacional requiere validar rigurosamente sus hipótesis analíticas y verificar la estabilidad numérica antes de su despliegue en entornos productivos.

> [!NOTE]
> Esta suite cuenta con soporte nativo para **Diagramas Mermaid**, **Alertas GFM** (\`[!NOTE]\`, \`[!TIP]\`, \`[!IMPORTANT]\`, \`[!WARNING]\`, \`[!CAUTION]\`), **tablas con alineación**, fórmulas matemáticas **KaTeX** y bloques de código con botón de copia rápida.

---

## 1. Flujo Algorítmico (Diagrama Mermaid)

\`\`\`mermaid
flowchart LR
    A["Entrada: f(x), x₀, tol"] --> B["Calcular f(xₙ) y f'(xₙ)"]
    B --> C{"¿|f(xₙ)| < tol?"}
    C -- Sí --> D["Raíz convergente xₙ"]
    C -- No --> E["xₙ₊₁ = xₙ - f(xₙ)/f'(xₙ)"]
    E --> B
\`\`\`

---

## 2. Fundamentación Teórica

Sea \\( f: [a, b] \\to \\mathbb{R} \\) una función dos veces continuamente diferenciable. La relación de recurrencia del método de **Newton-Raphson** se define analíticamente como:

\\[ x_{n+1} = x_n - \\frac{f(x_n)}{f'(x_n)}, \\quad n \\ge 0 \\]

El error en cada iteración satisface la relación de convergencia asintótica cuadrática:
\\[ |e_{n+1}| \\approx \\frac{|f''(r)|}{2|f'(r)|} |e_n|^2 \\]

---

## 3. Tabla Comparativa de Convergencia

| Iteración \\( n \\) | Aproximación \\( x_n \\) | \\( f(x_n) \\) | Error Estimado \\( |x_n - x_{n-1}| \\) |
| :---: | :---: | :---: | :---: |
| **0** | 2.000000 | 3.000000 | — |
| **1** | 1.750000 | 0.562500 | 0.250000 |
| **2** | 1.732143 | 0.002409 | 0.017857 |
| **3** | 1.732051 | 0.000001 | 0.000092 |

---

## 4. Implementación Algorítmica en Python

\`\`\`python
import numpy as np

def newton_raphson(f, df, x0, tol=1e-6, max_iter=50):
    """
    Aproximación de raíces continuas mediante el método de Newton-Raphson.
    """
    x = float(x0)
    for i in range(max_iter):
        fx = f(x)
        dfx = df(x)
        if abs(dfx) < 1e-12:
            raise ZeroDivisionError(f"Derivada nula detectada en x = {x}")
        x_next = x - fx / dfx
        if abs(x_next - x) < tol:
            return x_next, i + 1
        x = x_next
    return x, max_iter

# Función objetivo: f(x) = x^2 - 3 (raíz exacta sqrt(3) ≈ 1.7320508)
f = lambda x: x**2 - 3
df = lambda x: 2 * x
raiz, iteraciones = newton_raphson(f, df, x0=2.0)
print(f"Raíz calculada: {raiz:.6f} en {iteraciones} iteraciones")
\`\`\`

---

## 5. Lista de Verificación de Requisitos

- [x] Función continua y diferenciable en el intervalo de búsqueda.
- [x] Primera derivada no nula en la vecindad de la raíz (\\( f'(x) \\ne 0 \\)).
- [x] Tolerancia numérica satisfecha (\\( \\le 10^{-6} \\)).
- [ ] Validación de orden superior ante raíces múltiples.

> [!TIP]
> Puedes exportar el diagrama Mermaid directamente a SVG o copiar su sintaxis haciendo clic en los botones de la barra superior del diagrama.`;

  window.APP_CONFIG = {
    CONFIG,
    AUTO_CLOSE_MAP,
    CLOSING_DELIMITERS,
    DEFAULT_MOODLE_TEMPLATE,
    DEFAULT_MARKDOWN_TEMPLATE
  };
})();
