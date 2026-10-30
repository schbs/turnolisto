# Marca: Clínica Dental Confluencia (ficticia) · producto TurnoListo

> Proyecto de demostración — marca ficticia. Ningún dato corresponde a una clínica real.

## Idea
Una clínica de barrio en Neuquén, donde confluyen el Limay y el Neuquén. **Limpia y cálida**: mucho aire, fondo crema
en lugar de blanco hospital, verde menta profundo como color de confianza y un coral suave que aporta calidez.
Nada de azul "clínico" ni de fotos de sonrisas de stock.

## Paleta (contraste medido con la fórmula WCAG 2.1)

| Token | Hex | Uso | Contraste |
|---|---|---|---|
| `crema` | `#FBF6EF` | Fondo general | — |
| `blanco` | `#FFFFFF` | Tarjetas y paneles | — |
| `tinta` | `#1F2B2E` | Texto principal | 13,53 sobre crema · 14,55 sobre blanco |
| `tinta-suave` | `#4A5A5E` | Texto secundario | 6,70 sobre crema |
| `menta-700` | `#0E6863` | Botón principal (texto blanco), links | blanco encima 6,61 · 6,14 sobre crema |
| `menta-50` | `#E3F1EE` | Fondos suaves, chips | menta-700 encima 5,69 |
| `coral-700` | `#A3412A` | Acentos con texto, avisos | 5,84 sobre crema · 5,38 sobre coral-50 |
| `coral-50` | `#FCEAE3` | Fondo de avisos | — |
| `coral-400` | `#E8826A` | **Solo decorativo** (formas, ilustración). Nunca texto ni ícono con significado | 2,49: no pasa para texto |
| `borde` | `#857A6E` | Bordes de campos de formulario | 3,90 sobre crema (≥ 3:1) |
| `foco` | `#0B4F7A` | Anillo de foco de 2 px separado 2 px | 8,09 sobre crema |

Estados del turno (siempre con texto e ícono, nunca solo color):

| Estado | Texto / fondo | Contraste | Ícono |
|---|---|---|---|
| Reservado | `#8A5A00` / `#FFF4D6` | 5,41 | reloj |
| Confirmado | `#1E6B3A` / `#E4F4E8` | 5,72 | tilde |
| Cancelado | `#555555` / `#EEEEEE` | 6,43 | cruz |
| Ausente | `#A11E1E` / `#FBE6E6` | 6,46 | signo de exclamación |

## Tipografías (Google Fonts, con `next/font`)
- **Títulos:** Lexend (500 y 600). Pensada para lectura fácil; redondeada sin ser infantil.
- **Texto:** Atkinson Hyperlegible (400 y 700). Diseñada para baja visión: cada letra se distingue (I/l/1, 0/O).
  Encaja con pacientes de todas las edades. Mínimo 16 px en texto corrido, 14 px en datos de tabla.

## Layout
- Mobile-first (390 px). Columnas anchas con mucho aire, esquinas redondeadas grandes (16 px) y sombras casi nulas.
- Landing: una sola columna con un "ticket de turno" como pieza central (forma de tarjeta con borde punteado y la hora grande).
- Panel de recepción: agenda semanal en grilla por profesional; en celular, lista por día.

## Iconografía
Trazo de 1,75 px, esquinas redondeadas (estilo Lucide). Íconos propios para diente, reloj, calendario y WhatsApp genérico
(sin logo oficial de Meta en la interfaz de la clínica).

## Tono de voz
Español rioplatense, cálido y corto: "¡Hola! Soy el asistente de turnos de la Clínica Confluencia". Tuteo, sin
diminutivos empalagosos ni emojis en exceso (uno por mensaje, como mucho). Ante dolor o urgencia, serio y directo,
y siempre con la opción de hablar con recepción.

## Footer obligatorio
"Proyecto de demostración — marca ficticia".
