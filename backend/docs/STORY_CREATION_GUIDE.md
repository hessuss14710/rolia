# Guía de Creación de Historias para RolIA

## Índice

1. [Introducción](#introducción)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Estructura de una Campaña](#estructura-de-una-campaña)
4. [Creación de NPCs](#creación-de-npcs)
5. [Sistema de Decisiones](#sistema-de-decisiones)
6. [Pistas y Giros Argumentales](#pistas-y-giros-argumentales)
7. [Finales Múltiples](#finales-múltiples)
8. [Sistema de Karma](#sistema-de-karma)
9. [Integración con IA](#integración-con-ia)
10. [Formato de Datos](#formato-de-datos)
11. [Ejemplos Prácticos](#ejemplos-prácticos)
12. [Checklist de Creación](#checklist-de-creación)

---

## Introducción

El Sistema de Historias Épicas de RolIA permite crear campañas narrativas inmersivas con:

- **Narrativa ramificada**: Las decisiones de los jugadores afectan el desarrollo de la historia
- **NPCs dinámicos**: Personajes con personalidad, memoria y potencial de traición/redención
- **Sistema de karma**: Las acciones tienen consecuencias morales y afectan las relaciones
- **Múltiples finales**: El desenlace depende de las elecciones acumuladas
- **Giros argumentales**: Revelaciones dramáticas en momentos óptimos
- **Foreshadowing automático**: El sistema planta pistas sutiles antes de las revelaciones

### Filosofía de Diseño

> **La historia fluye naturalmente a través de la narración del AI. No hay quest trackers, diarios de misiones, ni indicadores visuales que rompan la inmersión. El jugador vive la historia, no la "gestiona".**

---

## Arquitectura del Sistema

### Componentes

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTE (React)                       │
│  - Chat con IA                                          │
│  - Hoja de personaje                                    │
│  - Selector de campaña (al crear sala)                  │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                 API GATEWAY (Node.js)                    │
│  - Rutas de juego (/game/*)                             │
│  - Rutas de campañas (/campaigns/*)                     │
│  - Socket.IO para tiempo real                           │
└─────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
│  Story Engine   │ │    Groq     │ │     Redis       │
│   (Python)      │ │     AI      │ │   State Store   │
│   FastAPI       │ │   Narrador  │ │   Caché rápido  │
│   Puerto 5001   │ │             │ │   Puerto 6379   │
└─────────────────┘ └─────────────┘ └─────────────────┘
           │               │               │
           └───────────────┼───────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│              PostgreSQL Database                         │
│  - Campañas, actos, capítulos, escenas                  │
│  - NPCs, decisiones, pistas, finales                    │
│  - Progreso de salas                                    │
└─────────────────────────────────────────────────────────┘
```

### Flujo de una Interacción

1. **Jugador envía mensaje** → Node.js recibe
2. **Node.js consulta Story Engine** → Python analiza intención, construye contexto
3. **Groq recibe contexto enriquecido** → Genera narración coherente con la historia
4. **Respuesta contiene marcadores** → `[KARMA: +5]`, `[NPC_REACT: varen:nervous]`
5. **Node.js procesa marcadores** → Actualiza estado en Redis/PostgreSQL
6. **Respuesta limpia al jugador** → Sin marcadores visibles

---

## Estructura de una Campaña

### Jerarquía

```
CAMPAÑA
├── Acto 1
│   ├── Capítulo 1.1
│   │   ├── Escena 1
│   │   ├── Escena 2
│   │   └── Decisión Crítica
│   └── Capítulo 1.2
│       ├── Escena 1
│       └── Mini-historia (Side Quest)
├── Acto 2
│   ├── Rama A (si eligió opción X)
│   └── Rama B (si eligió opción Y)
├── Acto 3 (Clímax)
└── Acto 4 (Desenlace - múltiples finales)
```

### Tabla: campaigns

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `name` | VARCHAR(255) | Nombre de la campaña |
| `code` | VARCHAR(50) | Identificador URL-friendly |
| `synopsis` | TEXT | Resumen para mostrar al crear sala |
| `tone` | VARCHAR(50) | 'dark', 'heroic', 'mystery', 'horror', 'comedy' |
| `difficulty` | VARCHAR(20) | 'casual', 'standard', 'hardcore' |
| `estimated_sessions` | INTEGER | Sesiones estimadas para completar |
| `total_acts` | INTEGER | Número de actos (típicamente 4) |

### Tabla: story_acts

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `campaign_id` | INTEGER | FK a campaigns |
| `act_number` | INTEGER | Orden del acto (1, 2, 3, 4) |
| `title` | VARCHAR(255) | "El Llamado", "La Telaraña", etc. |
| `description` | TEXT | Descripción del acto para contexto |
| `objectives` | TEXT[] | Array de objetivos narrativos |
| `unlock_conditions` | JSONB | Condiciones para desbloquear |

### Tabla: story_chapters

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `act_id` | INTEGER | FK a story_acts |
| `chapter_number` | INTEGER | Orden dentro del acto |
| `title` | VARCHAR(255) | Título del capítulo |
| `narrative_hook` | TEXT | Gancho narrativo inicial |
| `key_npcs` | JSONB | NPCs importantes (códigos) |
| `locations` | JSONB | Ubicaciones clave |
| `is_optional` | BOOLEAN | Si es un capítulo secundario |

### Tabla: story_scenes

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `chapter_id` | INTEGER | FK a story_chapters |
| `scene_order` | INTEGER | Orden dentro del capítulo |
| `scene_type` | VARCHAR(50) | Ver tipos de escena abajo |
| `title` | VARCHAR(255) | Título de la escena |
| `opening_narration` | TEXT | Narración de apertura |
| `ai_context` | TEXT | Contexto visible para el AI |
| `ai_secret_instructions` | TEXT | Instrucciones secretas (giros, foreshadowing) |
| `tension_level` | VARCHAR(20) | 'low', 'normal', 'high', 'critical' |

#### Tipos de Escena

- **narrative**: Desarrollo de historia, diálogos, exploración
- **combat**: Enfrentamientos y conflictos físicos
- **puzzle**: Acertijos, investigación, resolución de problemas
- **social**: Negociaciones, persuasión, interacciones complejas
- **revelation**: Momentos de descubrimiento importante
- **decision**: Punto de decisión crítica

---

## Creación de NPCs

### Tabla: story_npcs

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `campaign_id` | INTEGER | FK a campaigns |
| `code` | VARCHAR(50) | Identificador único (ej: "varen", "lyra") |
| `name` | VARCHAR(255) | Nombre completo |
| `role` | VARCHAR(100) | 'ally', 'enemy', 'neutral', 'traitor', 'secret_ally' |
| `true_role` | VARCHAR(100) | Rol real (para giros argumentales) |
| `description` | TEXT | Descripción física y de contexto |
| `personality` | TEXT | Rasgos de personalidad |
| `secrets` | TEXT[] | Secretos que guarda |
| `dialogue_style` | TEXT | Estilo de habla |
| `relationship_default` | INTEGER | Relación inicial (0-100) |

### Personalidad y Rasgos

Define rasgos en escala 0-100:

```json
{
  "cunning": 90,      // Astucia
  "loyalty": 10,      // Lealtad (a quién realmente sirve)
  "patience": 85,     // Paciencia
  "pride": 95,        // Orgullo
  "cruelty": 60,      // Crueldad
  "compassion": 20,   // Compasión
  "courage": 70,      // Valentía
  "guilt": 15         // Sentimiento de culpa
}
```

### Ejemplo de NPC Complejo

```json
{
  "code": "varen",
  "name": "Lord Varen Blackwood",
  "role": "ally",
  "true_role": "traitor",
  "description": "Alto, elegante, con una sonrisa que nunca llega a sus ojos grises. Siempre viste de negro y plata.",
  "personality": "Calculador y paciente. Proyecta confianza paternal pero cada palabra está medida. Oculta ambición despiadada tras una fachada de servicio leal.",
  "secrets": [
    "Es el verdadero padre del Príncipe Aldric",
    "Envenenó al rey anterior hace 20 años",
    "Lidera la Orden de la Llama Negra en secreto"
  ],
  "dialogue_style": "Formal, educado, usa metáforas y referencias literarias. Nunca pierde la compostura.",
  "relationship_default": 60
}
```

### Sistema de Traición

El Story Engine calcula automáticamente cuándo un NPC traidor ejecuta su traición:

```python
# Factores que ACELERAN traición
- Relación con jugadores < betrayal_threshold
- Acto actual >= planned_betrayal_act
- Su "amo verdadero" lo presiona

# Factores que RETRASAN/PREVIENEN traición
- Relación con jugadores > 80 (afecto genuino)
- Se cumplen condiciones de redención
- Story flags específicos
```

---

## Sistema de Decisiones

### Tabla: story_decisions

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `scene_id` | INTEGER | FK a story_scenes |
| `decision_code` | VARCHAR(50) | Identificador único |
| `title` | VARCHAR(255) | Título descriptivo |
| `description` | TEXT | Contexto de la decisión |
| `options` | JSONB | Opciones disponibles |
| `consequences` | JSONB | Consecuencias detalladas |
| `affects_ending` | BOOLEAN | Si afecta el final |
| `is_hidden` | BOOLEAN | Si es una decisión implícita |

### Estructura de Opciones

```json
{
  "options": [
    {
      "id": "trust",
      "label": "Confiar en Lord Varen",
      "karma": 0,
      "consequence_flags": ["trusted_varen"],
      "npc_effects": {
        "varen": { "relationship": 15, "trust": 20 }
      }
    },
    {
      "id": "investigate",
      "label": "Investigar en secreto",
      "karma": 0,
      "consequence_flags": ["investigating_varen"],
      "npc_effects": {
        "varen": { "relationship": -5, "suspicion": 10 }
      }
    },
    {
      "id": "confront",
      "label": "Confrontar directamente",
      "karma": 5,
      "consequence_flags": ["confronted_varen"],
      "npc_effects": {
        "varen": { "relationship": -20, "hostility": 30 }
      }
    }
  ]
}
```

### Decisiones Implícitas

Algunas decisiones se toman basándose en el comportamiento, no en elección explícita:

```json
{
  "decision_code": "lyra_loyalty",
  "is_hidden": true,
  "description": "Determinada por cómo trataron a Lyra a lo largo de la historia",
  "options": [
    {
      "id": "loyal",
      "condition": "relationship >= 70 AND helped_in_chapter_2",
      "result": "Lyra se pone del lado de los jugadores"
    },
    {
      "id": "betrays",
      "condition": "relationship < 40 OR ignored_warnings",
      "result": "Lyra los traiciona en momento crítico"
    }
  ]
}
```

---

## Pistas y Giros Argumentales

### Tabla: story_clues

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `campaign_id` | INTEGER | FK a campaigns |
| `code` | VARCHAR(50) | Identificador (ej: "clue_medallion") |
| `name` | VARCHAR(255) | Nombre de la pista |
| `description` | TEXT | Descripción de la pista |
| `related_twist` | VARCHAR(50) | Código del giro que revela |
| `reveal_conditions` | JSONB | Condiciones para revelar |
| `importance` | VARCHAR(20) | 'minor', 'major', 'critical' |

### Foreshadowing Automático

El Twist Engine genera pistas sutiles automáticamente:

```python
# El AI recibe instrucciones como:
"Cuando describas a Lord Varen, menciona sutilmente que evita mirar
directamente a la Reina. No lo hagas obvio, solo un detalle de pasada."

"Si los jugadores mencionan el medallón cerca de Varen, describe
cómo su mano se cierra brevemente en un puño antes de relajarse."
```

### Estructura de Giros

```json
{
  "twist_id": "varen_true_nature",
  "required_clues": ["clue_medallion", "clue_poison", "clue_letter"],
  "min_clues_for_reveal": 2,
  "optimal_reveal_act": 3,
  "foreshadowing_elements": [
    {
      "scene_type": "social",
      "subtle_hint": "Varen evita la mirada de la Reina"
    },
    {
      "scene_type": "narrative",
      "subtle_hint": "Un sirviente antiguo se pone nervioso al ver a Varen"
    }
  ],
  "red_herrings": [
    {
      "false_suspect": "El capitán de la guardia",
      "misleading_clue": "Fue visto cerca de los aposentos del Rey la noche de su muerte"
    }
  ]
}
```

---

## Finales Múltiples

### Tabla: story_endings

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `campaign_id` | INTEGER | FK a campaigns |
| `code` | VARCHAR(50) | Identificador (ej: "ending_a") |
| `name` | VARCHAR(255) | "El Rey Justo", "La Paz del Silencio", etc. |
| `description` | TEXT | Descripción del final |
| `conditions` | JSONB | Condiciones requeridas |
| `epilogue` | TEXT | Texto de epílogo |
| `is_good_ending` | BOOLEAN | Si es considerado "buen" final |

### Condiciones de Final

```json
{
  "code": "ending_a",
  "name": "El Rey Justo",
  "description": "Aldric asciende al trono con apoyo popular. Los héroes son nombrados Guardianes del Reino.",
  "conditions": {
    "required_flags": ["exposed_conspiracy", "saved_queen"],
    "forbidden_flags": ["varen_escaped", "queen_died"],
    "karma_range": [40, 100],
    "npc_conditions": {
      "aldric": { "relationship_min": 60 },
      "lyra": { "loyalty": true }
    }
  },
  "is_good_ending": true
}
```

### Cálculo de Probabilidades

El sistema calcula en tiempo real las probabilidades de cada final:

```python
# Ejemplo de output
{
  "ending_a": 0.45,  # 45% probabilidad
  "ending_b": 0.30,  # 30% probabilidad
  "ending_c": 0.15,  # 15% probabilidad
  "ending_d": 0.10   # 10% probabilidad
}
```

---

## Sistema de Karma

### Acciones de Karma

```python
KARMA_ACTIONS = {
    # Acciones positivas
    "helped_innocent": +10,
    "showed_mercy": +15,
    "donated_to_poor": +12,
    "kept_promise": +10,
    "exposed_corruption": +20,
    "protected_weak": +15,

    # Acciones negativas
    "lied_for_gain": -5,
    "stole": -8,
    "killed_unarmed": -20,
    "broke_promise": -15,
    "betrayed_ally": -30,
    "used_dark_magic": -25,

    # Acciones neutras con contexto
    "killed_enemy": 0,  # Depende del contexto
    "accepted_bribe": -10,
    "refused_bribe": +5
}
```

### Niveles de Karma

| Rango | Nivel | Descripción |
|-------|-------|-------------|
| 80-100 | Heroico | "Los bardos cantan sus hazañas" |
| 60-79 | Noble | "Respetados por su integridad" |
| 40-59 | Neutral | "Pragmáticos sin inclinación clara" |
| 20-39 | Cuestionable | "Rumores sombríos los siguen" |
| 0-19 | Infame | "El pueblo los teme" |

### Efectos del Karma

- NPCs reaccionan diferente según karma del grupo
- Opciones de diálogo disponibles/bloqueadas
- Finales accesibles/bloqueados
- Precios en tiendas, cooperación de civiles

---

## Integración con IA

### Contexto Enriquecido

El Story Engine construye contexto completo para Groq:

```
CONTEXTO NARRATIVO:
- Campaña: Las Sombras de Valdoria
- Acto: 2 - La Telaraña
- Capítulo: El Pacto Revelado
- Escena: Confrontación en las ruinas

ESTADO ACTUAL:
- Karma del grupo: 65 (Noble)
- Tensión: Alta
- Decisiones previas: [trusted_varen, helped_marcus]

NPCs PRESENTES:
- Lord Varen (relación: 70, estado: confiado pero vigilante)
  * Secretos conocidos: ninguno
  * Secretos ocultos: padre de Aldric, líder de la Orden

- Lyra (relación: 55, estado: nerviosa)
  * Conoce: es espía del príncipe
  * Oculto: hermana de Varen

INSTRUCCIONES SECRETAS (NO REVELAR):
- Varen planea emboscada en 2 escenas
- Foreshadowing: mencionar que Varen mira hacia las sombras
- Si preguntan por el medallón, Varen cambia de tema

PISTAS DISPONIBLES PARA REVELAR:
- clue_003: La conexión entre Varen y la Orden
```

### Marcadores en Respuestas

El AI incluye marcadores que el sistema procesa:

```
"Lord Varen inclina la cabeza en señal de respeto, pero
notas que sus ojos grises se desvían hacia las sombras
del pasillo. 'Por supuesto, mis señores. Estoy a su
servicio... como siempre lo he estado.'

[KARMA: +5 por negociar en lugar de atacar]
[NPC_REACT: varen:calculating:impressed_by_diplomacy]
[CLUE_REVEALED: clue_002]
[TENSION: increasing]"
```

---

## Formato de Datos

### Archivo JSON de Campaña

Las campañas se definen en archivos JSON que luego se convierten a SQL:

```
/backend/data/campaigns/
├── sombras-de-valdoria.json     # Definición completa
└── seed-sombras-valdoria.sql    # SQL para insertar datos
```

### Estructura del JSON

```json
{
  "campaign": {
    "code": "sombras-valdoria",
    "name": "Las Sombras de Valdoria",
    "theme": "Fantasía Medieval",
    "synopsis": "...",
    "tone": "dark",
    "difficulty": "standard",
    "estimated_sessions": 12
  },
  "acts": [
    {
      "number": 1,
      "title": "El Llamado",
      "description": "...",
      "objectives": ["...", "..."],
      "chapters": [
        {
          "number": 1,
          "title": "La Convocatoria",
          "narrative_hook": "...",
          "key_npcs": ["varen", "isadora"],
          "scenes": [
            {
              "order": 1,
              "type": "narrative",
              "title": "Llegada a la Capital",
              "opening_narration": "...",
              "ai_context": "...",
              "ai_secret_instructions": "..."
            }
          ]
        }
      ]
    }
  ],
  "npcs": [ /* ... */ ],
  "decisions": [ /* ... */ ],
  "clues": [ /* ... */ ],
  "endings": [ /* ... */ ]
}
```

---

## Ejemplos Prácticos

### Ejemplo 1: Crear un NPC con Arco de Redención

```json
{
  "code": "lyra",
  "name": "Lyra Blackwood",
  "role": "neutral",
  "true_role": "redeemable_traitor",
  "personality": "Dividida entre lealtad familiar y su propia moral. Genuinamente quiere ayudar pero está atrapada en las maquinaciones de su hermano.",
  "secrets": [
    "Es hermana de Lord Varen",
    "Fue enviada para espiar a los héroes",
    "Secretamente admira su valentía"
  ],
  "redemption_arc": {
    "trigger_conditions": ["relationship >= 70", "showed_her_kindness"],
    "redemption_scene": "act_3_chapter_2_scene_1",
    "if_redeemed": "Revela la traición de Varen, ayuda en batalla final",
    "if_not_redeemed": "Los traiciona en momento crítico, escapa con Varen"
  }
}
```

### Ejemplo 2: Crear una Decisión Ramificada

```json
{
  "decision_code": "help_or_investigate_aldric",
  "scene_id": "act2_ch2_scene3",
  "title": "El Dilema del Príncipe",
  "description": "Aldric pide ayuda directa, pero algo en su historia no cuadra.",
  "options": [
    {
      "id": "help_immediately",
      "label": "Ayudar sin cuestionar",
      "consequences": {
        "immediate": "Aldric confía plenamente",
        "long_term": "Menos información, posible trampa",
        "flags": ["trusted_aldric_blindly"],
        "branches_to": "act2_ch3_direct_path"
      }
    },
    {
      "id": "investigate_first",
      "label": "Pedir pruebas antes de actuar",
      "consequences": {
        "immediate": "Aldric se frustra brevemente",
        "long_term": "Descubren más verdades",
        "flags": ["questioned_aldric", "found_additional_evidence"],
        "branches_to": "act2_ch3_investigation_path"
      }
    }
  ]
}
```

### Ejemplo 3: Configurar un Giro Argumental

```json
{
  "twist_id": "aldric_parentage",
  "name": "La Verdadera Sangre",
  "revelation": "Lord Varen es el padre biológico del Príncipe Aldric",
  "required_clues": [
    "clue_royal_portrait",
    "clue_midwife_testimony",
    "clue_varen_locket"
  ],
  "min_clues_for_reveal": 2,
  "optimal_moment": {
    "act": 2,
    "tension": "high",
    "npc_present": ["aldric", "varen"]
  },
  "foreshadowing": [
    "Varen muestra familiaridad excesiva con los gustos de Aldric",
    "La Reina evita que Varen y Aldric estén solos",
    "Parecido físico sutil que los jugadores pueden notar"
  ],
  "impact": {
    "story_flags": ["parentage_revealed"],
    "npc_reactions": {
      "aldric": "shock, then anger at both Varen and Isadora",
      "varen": "tries to use this to manipulate Aldric",
      "isadora": "decades of hidden pain surface"
    }
  }
}
```

---

## Checklist de Creación

### Antes de Empezar

- [ ] Definir el tono general (heroico, oscuro, misterio, etc.)
- [ ] Establecer la premisa central en una oración
- [ ] Identificar el conflicto principal
- [ ] Decidir número de actos (recomendado: 4)
- [ ] Estimar sesiones de juego (10-15 típico)

### Por Cada Acto

- [ ] Título evocador
- [ ] Objetivo narrativo claro
- [ ] Clímax del acto definido
- [ ] Transición al siguiente acto planeada
- [ ] Ramificaciones identificadas

### Por Cada Capítulo

- [ ] Gancho narrativo inicial
- [ ] NPCs clave listados
- [ ] Ubicaciones definidas
- [ ] Mini-historias opcionales consideradas
- [ ] Pistas a revelar identificadas

### Por Cada Escena

- [ ] Tipo de escena definido
- [ ] Narración de apertura escrita
- [ ] Contexto para AI claro
- [ ] Instrucciones secretas si aplica
- [ ] Nivel de tensión establecido
- [ ] Conexión a siguiente escena

### Por Cada NPC Principal

- [ ] Nombre y descripción física
- [ ] Personalidad y motivaciones
- [ ] Rol aparente vs rol verdadero
- [ ] Secretos (al menos 2-3)
- [ ] Estilo de diálogo
- [ ] Arco de personaje
- [ ] Condiciones de traición/redención si aplica

### Por Cada Decisión Crítica

- [ ] Código único
- [ ] Título descriptivo
- [ ] Al menos 3 opciones
- [ ] Consecuencias claras
- [ ] Flags resultantes
- [ ] Impacto en finales

### Por Cada Final

- [ ] Nombre evocador
- [ ] Descripción clara
- [ ] Condiciones específicas
- [ ] Epílogo escrito
- [ ] Clasificación (bueno/neutral/malo)

### Validación Final

- [ ] Todas las ramas tienen resolución
- [ ] No hay deadends narrativos
- [ ] Los giros tienen suficiente foreshadowing
- [ ] El karma afecta consistentemente
- [ ] Los NPCs tienen reacciones coherentes
- [ ] Todos los finales son alcanzables

---

## Recursos Adicionales

### Herramientas de Desarrollo

```bash
# Validar JSON de campaña
python -m json.tool < campaign.json

# Generar SQL desde JSON (script a crear)
python scripts/campaign_to_sql.py campaign.json

# Probar Story Engine localmente
cd /srv/rolia/story-engine
uvicorn main:app --reload --port 5001
```

### Endpoints de Debug

```bash
# Ver estado actual de historia
GET /api/campaigns/progress/:roomCode

# Ver probabilidades de finales
GET /api/campaigns/endings/:roomCode

# Ver NPCs y relaciones
GET /api/campaigns/npcs/:roomCode
```

### Referencia: "Sombras de Valdoria"

La campaña de ejemplo completa está en:
- JSON: `/backend/data/campaigns/sombras-de-valdoria.json`
- SQL: `/backend/data/campaigns/seed-sombras-valdoria.sql`

---

*Guía creada para RolIA - Sistema de Historias Épicas v1.0*
